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
  // Gen2 / Cloud Run sometimes presents the full URL path.
  if (path.includes("/realtimeProxy/")) {
    path = path.slice(path.indexOf("/realtimeProxy/") + "/realtimeProxy".length) || "/";
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
 * Rebuild a raw body Buffer for partytracks.
 *
 * Important: Express/Firebase often sets `req.body` to `{}` for empty JSON
 * POSTs. Treating that as a real body sends "{}" to Cloudflare and breaks
 * `/sessions/new`. Only forward non-empty payloads.
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
    const trimmed = req.body.trim();
    if (!trimmed || trimmed === "{}") return undefined;
    return Buffer.from(req.body);
  }
  if (typeof req.body === "object") {
    if (Array.isArray(req.body)) {
      return Buffer.from(JSON.stringify(req.body));
    }
    // Empty object from JSON parser — not a real client payload.
    if (Object.keys(req.body as object).length === 0) return undefined;
    return Buffer.from(JSON.stringify(req.body));
  }
  return undefined;
}

/** Keep classId for our auth gate only — never forward it to Cloudflare SFU. */
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

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * partytracks forwards `request.body` (a ReadableStream) into `fetch()`.
 * Node 18+/undici requires `duplex: "half"` for stream bodies — without it
 * every tracks/new (and any POST with a body) throws and we return 500.
 */
async function withStreamBodyFetch<T>(fn: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (init?.body != null && (init as { duplex?: string }).duplex == null) {
      const body = init.body as { getReader?: unknown };
      if (typeof body === "object" && typeof body.getReader === "function") {
        return originalFetch(input, { ...init, duplex: "half" } as RequestInit);
      }
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/**
 * The only "video" backend function. Every session/track/renegotiate call from
 * the browser comes through here first: verify Firebase Auth + enrollment/role
 * for this class, then hand off to Cloudflare's `routePartyTracksRequest`.
 */
export const realtimeProxy = onRequest(
  {
    cors: true,
    secrets: [cfRealtimeAppId, cfRealtimeAppToken, cfTurnAppId, cfTurnAppToken],
    // Live-class media negotiation can be chatty; keep instances warm-ish.
    timeoutSeconds: 60,
    memory: "512MiB",
  },
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
      const method = (req.method || "GET").toUpperCase();

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

      const appId = cfRealtimeAppId.value()?.trim();
      const appToken = cfRealtimeAppToken.value()?.trim();
      if (!appId || !appToken) {
        logger.error("realtimeProxy missing Cloudflare Realtime secrets");
        res.status(500).send("Live class media is not configured (missing Cloudflare secrets).");
        return;
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
          lower === "transfer-encoding" ||
          lower === "accept-encoding" // avoid compressed upstream bodies we mishandle
        ) {
          continue;
        }
        if (typeof value === "string") headers.set(key, value);
        else if (Array.isArray(value)) headers.set(key, value.join(", "));
      }

      // partytracks only attaches `body` when Content-Length > 0.
      // Google frontends return HTTP 411 if POST has neither body nor Content-Length.
      // That HTML 411 previously made partytracks throw while parsing JSON → opaque 500.
      if (bodyBuf && bodyBuf.length > 0) {
        headers.set("content-length", String(bodyBuf.length));
        if (!headers.has("content-type")) {
          headers.set("content-type", "application/json");
        }
      } else if (method !== "GET" && method !== "HEAD") {
        headers.set("content-length", "0");
        headers.delete("content-type");
      }

      const cfSearch = cloudflareSearch(search);
      const fetchRequest = new Request(`https://internal.local${path}${cfSearch}`, {
        method,
        headers,
        ...(bodyBuf && bodyBuf.length > 0 ? { body: bodyBuf } : {}),
      });

      let response: Response;
      try {
        response = await withStreamBodyFetch(() =>
          routePartyTracksRequest({
            appId,
            token: appToken,
            turnServerAppId: cfTurnAppId.value()?.trim() || undefined,
            turnServerAppToken: cfTurnAppToken.value()?.trim() || undefined,
            prefix: CLIENT_PREFIX,
            lockSessionToInitiator: true,
            request: fetchRequest,
          }),
        );
      } catch (upstreamErr) {
        logger.error("realtimeProxy partytracks failure", {
          path,
          method,
          uid,
          classId: classId || null,
          bodyBytes: bodyBuf?.length ?? 0,
          error: errorMessage(upstreamErr),
        });
        res
          .status(502)
          .send(
            `Cloudflare Realtime request failed (${path}): ${errorMessage(upstreamErr)}`,
          );
        return;
      }

      if (response.status >= 400) {
        const errText = await response.clone().text().catch(() => "");
        logger.warn("realtimeProxy upstream error", {
          status: response.status,
          path,
          method,
          uid,
          classId: classId || null,
          bodyBytes: bodyBuf?.length ?? 0,
          upstream: errText.slice(0, 500),
        });
      }

      res.status(response.status);
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === "set-cookie") return;
        // Avoid leaking hop-by-hop / encoding issues through Vercel rewrite.
        if (key.toLowerCase() === "transfer-encoding") return;
        if (key.toLowerCase() === "content-encoding") return;
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
      // Ensure clients always get an explicit length through proxies.
      res.setHeader("content-length", String(buf.length));
      res.send(buf);
    } catch (error) {
      logger.error("realtimeProxy error", error);
      res.status(500).send(`Realtime proxy error: ${errorMessage(error)}`);
    }
  },
);
