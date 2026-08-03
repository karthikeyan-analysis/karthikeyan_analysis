import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";
import { resolveCallerAccess } from "./access";

export const cfRealtimeAppId = defineSecret("CF_REALTIME_APP_ID");
export const cfRealtimeAppToken = defineSecret("CF_REALTIME_APP_TOKEN");
export const cfTurnAppId = defineSecret("CF_TURN_APP_ID");
export const cfTurnAppToken = defineSecret("CF_TURN_APP_TOKEN");

/**
 * Client-facing proxy path (Vercel rewrite + Vite dev proxy). Must match
 * `realtimeClient.ts` and the cookie Path set by `routePartyTracksRequest`.
 */
const CLIENT_PREFIX = "/api/realtime";

function normalizeProxyPath(reqPath: string, reqUrl: string): { path: string; search: string } {
  let path = reqPath || "/";
  if (path.startsWith("/realtimeProxy")) {
    path = path.slice("/realtimeProxy".length) || "/";
  }
  if (!path.startsWith(CLIENT_PREFIX)) {
    path = `${CLIENT_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;
  }
  const search = reqUrl.includes("?") ? reqUrl.slice(reqUrl.indexOf("?")) : "";
  return { path, search };
}

function isIceServersPath(path: string): boolean {
  return path.endsWith("/generate-ice-servers");
}

/**
 * partytracks only forwards a request body when Content-Length > 0.
 * Firebase/Express often leaves us with a parsed `req.body` and we must
 * rebuild a Buffer + Content-Length or tracks/new reaches Cloudflare empty → 400.
 */
function resolveRequestBody(req: {
  method?: string;
  rawBody?: Buffer;
  body?: unknown;
}): Buffer | undefined {
  const method = (req.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return undefined;

  if (Buffer.isBuffer(req.rawBody) && req.rawBody.length > 0) {
    return req.rawBody;
  }

  if (req.body == null || req.body === "") return undefined;
  if (Buffer.isBuffer(req.body)) return req.body.length > 0 ? req.body : undefined;
  if (typeof req.body === "string") {
    return req.body.length > 0 ? Buffer.from(req.body) : undefined;
  }
  // Express JSON parser
  return Buffer.from(JSON.stringify(req.body));
}

/**
 * Keep classId for our auth gate only — do not forward it to Cloudflare SFU.
 * Unknown query params on tracks/new can yield opaque 400s from the Realtime API.
 */
function cloudflareSearch(search: string): string {
  if (!search) return "";
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete("classId");
  const next = params.toString();
  return next ? `?${next}` : "";
}

function isLocalHttpOrigin(origin: string, referer: string): boolean {
  const candidates = [origin, referer];
  return candidates.some(
    (value) =>
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value) ||
      /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(value),
  );
}

/**
 * The only "video" backend function. Every session/track/renegotiate call from
 * the browser comes through here first: verify Firebase Auth + enrollment/role
 * for this class, then hand off to Cloudflare's `routePartyTracksRequest`.
 */
export const realtimeProxy = onRequest(
  { cors: true, secrets: [cfRealtimeAppId, cfRealtimeAppToken, cfTurnAppId, cfTurnAppToken] },
  async (req, res) => {
    try {
      const authHeader = req.get("Authorization") || "";
      const idToken = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!idToken) {
        res.status(401).send("Unauthorized");
        return;
      }

      let uid: string;
      try {
        uid = (await admin.auth().verifyIdToken(idToken)).uid;
      } catch {
        res.status(401).send("Invalid token");
        return;
      }

      const { path, search } = normalizeProxyPath(req.path || "/", req.url || "");

      const classId = String(req.query.classId || "");
      if (!classId) {
        if (!isIceServersPath(path)) {
          res.status(400).send("classId required");
          return;
        }
      } else {
        const db = admin.firestore();
        const classSnap = await db.collection("liveClasses").doc(classId).get();
        if (!classSnap.exists) {
          res.status(404).send("Class not found");
          return;
        }
        const cls = classSnap.data() as Record<string, any>;

        const access = await resolveCallerAccess(db, uid, cls);
        if (access.kind === "denied") {
          res.status(403).send(access.reason);
          return;
        }
        if (access.kind === "admin") {
          res.status(403).send("You're not assigned as a host or co-host for this class.");
          return;
        }
        if (access.kind === "student" && cls.status !== "active") {
          res.status(412).send("The host hasn't started this class yet.");
          return;
        }
      }

      const { routePartyTracksRequest } = await import("partytracks/server");

      const bodyBuf = resolveRequestBody(req);

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        const lower = key.toLowerCase();
        // Host/length are recomputed; hop-by-hop headers must not be forwarded.
        if (
          lower === "host" ||
          lower === "content-length" ||
          lower === "connection" ||
          lower === "transfer-encoding"
        ) {
          continue;
        }
        if (typeof value === "string") headers.set(key, value);
        else if (Array.isArray(value)) headers.set(key, value.join(", "));
      }

      // partytracks only attaches `body` when Content-Length > 0. Always set it
      // ourselves from the buffer we will send.
      if (bodyBuf) {
        headers.set("content-length", String(bodyBuf.length));
        if (!headers.has("content-type")) {
          headers.set("content-type", "application/json");
        }
      }

      const cfSearch = cloudflareSearch(search);
      const fetchRequest = new Request(`https://internal.local${path}${cfSearch}`, {
        method: req.method,
        headers,
        body: bodyBuf,
      });

      const response = await routePartyTracksRequest({
        appId: cfRealtimeAppId.value(),
        token: cfRealtimeAppToken.value(),
        turnServerAppId: cfTurnAppId.value() || undefined,
        turnServerAppToken: cfTurnAppToken.value() || undefined,
        prefix: CLIENT_PREFIX,
        lockSessionToInitiator: true,
        request: fetchRequest,
      });

      if (response.status >= 400) {
        const errText = await response.clone().text().catch(() => "");
        logger.warn("realtimeProxy upstream error", {
          status: response.status,
          path,
          uid,
          classId: classId || null,
          bodyBytes: bodyBuf?.length ?? 0,
          upstream: errText.slice(0, 500),
        });
      }

      res.status(response.status);
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === "set-cookie") return;
        res.setHeader(key, value);
      });

      const setCookies =
        (response.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
      const origin = req.get("origin") || "";
      const referer = req.get("referer") || "";
      const localHttp = isLocalHttpOrigin(origin, referer);
      for (const cookie of setCookies) {
        // partytracks always sets Secure; browsers on http://LAN drop it.
        const adjusted = localHttp ? cookie.replace(/;\s*Secure/gi, "") : cookie;
        res.append("set-cookie", adjusted);
      }

      const buf = Buffer.from(await response.arrayBuffer());
      res.send(buf);
    } catch (error) {
      logger.error("realtimeProxy error", error);
      res.status(500).send("Internal error");
    }
  },
);
