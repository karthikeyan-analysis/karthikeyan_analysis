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
 * Using "" here breaks Path= on the session-lock cookie and can 404 depending
 * on how the path is rewritten into the Fetch Request.
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
 * The only "video" backend function. Every session/track/renegotiate call from
 * the browser comes through here first: verify Firebase Auth + enrollment/role
 * for this class, then hand off to Cloudflare's `routePartyTracksRequest`
 * (dynamic import — partytracks is ESM-only; this project is CommonJS).
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

      // partytracks' built-in ICE fetch omits query params. Allow authenticated
      // callers to mint ICE/TURN without classId so session setup can proceed.
      // Session/track routes still require class-scoped authorization below.
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

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === "string") headers.set(key, value);
        else if (Array.isArray(value)) headers.set(key, value.join(", "));
      }
      headers.delete("host");
      headers.delete("content-length");

      const hasBody = !["GET", "HEAD"].includes(req.method) && (req.rawBody?.length ?? 0) > 0;

      const fetchRequest = new Request(`https://internal.local${path}${search}`, {
        method: req.method,
        headers,
        body: hasBody ? req.rawBody : undefined,
      });

      const response = await routePartyTracksRequest({
        appId: cfRealtimeAppId.value(),
        token: cfRealtimeAppToken.value(),
        turnServerAppId: cfTurnAppId.value() || undefined,
        turnServerAppToken: cfTurnAppToken.value() || undefined,
        prefix: CLIENT_PREFIX,
        // Default in partytracks is NODE_ENV==="production" only — Functions
        // often don't set that, so lock must be forced on explicitly.
        lockSessionToInitiator: true,
        request: fetchRequest,
      });

      res.status(response.status);
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === "set-cookie") return;
        res.setHeader(key, value);
      });

      // Headers.forEach comma-joins repeated Set-Cookie values — use getSetCookie.
      const setCookies =
        (response.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
      const origin = req.get("origin") || "";
      const referer = req.get("referer") || "";
      const isLocalHttp =
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(referer) ||
        /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(origin) ||
        /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(referer);
      for (const cookie of setCookies) {
        // partytracks always sets Secure; browsers on http://localhost drop it.
        // Strip Secure only for local Vite so session-lock still works in dev.
        const adjusted = isLocalHttp ? cookie.replace(/;\s*Secure/gi, "") : cookie;
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
