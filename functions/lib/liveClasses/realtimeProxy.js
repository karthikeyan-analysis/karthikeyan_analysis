"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.realtimeProxy = exports.cfTurnAppToken = exports.cfTurnAppId = exports.cfRealtimeAppToken = exports.cfRealtimeAppId = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const params_1 = require("firebase-functions/params");
const access_1 = require("./access");
exports.cfRealtimeAppId = (0, params_1.defineSecret)("CF_REALTIME_APP_ID");
exports.cfRealtimeAppToken = (0, params_1.defineSecret)("CF_REALTIME_APP_TOKEN");
exports.cfTurnAppId = (0, params_1.defineSecret)("CF_TURN_APP_ID");
exports.cfTurnAppToken = (0, params_1.defineSecret)("CF_TURN_APP_TOKEN");
/**
 * Client-facing proxy path (Vercel rewrite + Vite dev proxy). Must match
 * `realtimeClient.ts` and the cookie Path set by `routePartyTracksRequest`.
 * Using "" here breaks Path= on the session-lock cookie and can 404 depending
 * on how the path is rewritten into the Fetch Request.
 */
const CLIENT_PREFIX = "/api/realtime";
/**
 * The only "video" backend function. Every session/track/renegotiate call from
 * the browser comes through here first: verify Firebase Auth + enrollment/role
 * for this class, then hand off to Cloudflare's `routePartyTracksRequest`
 * (dynamic import — partytracks is ESM-only; this project is CommonJS).
 */
exports.realtimeProxy = (0, https_1.onRequest)({ cors: true, secrets: [exports.cfRealtimeAppId, exports.cfRealtimeAppToken, exports.cfTurnAppId, exports.cfTurnAppToken] }, async (req, res) => {
    try {
        const authHeader = req.get("Authorization") || "";
        const idToken = authHeader.replace(/^Bearer\s+/i, "").trim();
        if (!idToken) {
            res.status(401).send("Unauthorized");
            return;
        }
        let uid;
        try {
            uid = (await admin.auth().verifyIdToken(idToken)).uid;
        }
        catch {
            res.status(401).send("Invalid token");
            return;
        }
        const classId = String(req.query.classId || "");
        if (!classId) {
            res.status(400).send("classId required");
            return;
        }
        const db = admin.firestore();
        const classSnap = await db.collection("liveClasses").doc(classId).get();
        if (!classSnap.exists) {
            res.status(404).send("Class not found");
            return;
        }
        const cls = classSnap.data();
        const access = await (0, access_1.resolveCallerAccess)(db, uid, cls);
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
        const { routePartyTracksRequest } = await import("partytracks/server");
        // Some runtimes strip the function name from req.path; others leave it.
        let path = req.path || "/";
        if (path.startsWith("/realtimeProxy")) {
            path = path.slice("/realtimeProxy".length) || "/";
        }
        // Always present the client-facing prefix to partytracks so cookie Path
        // and pathname matching stay consistent with the browser URL.
        if (!path.startsWith(CLIENT_PREFIX)) {
            path = `${CLIENT_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;
        }
        const search = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === "string")
                headers.set(key, value);
            else if (Array.isArray(value))
                headers.set(key, value.join(", "));
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
            appId: exports.cfRealtimeAppId.value(),
            token: exports.cfRealtimeAppToken.value(),
            turnServerAppId: exports.cfTurnAppId.value() || undefined,
            turnServerAppToken: exports.cfTurnAppToken.value() || undefined,
            prefix: CLIENT_PREFIX,
            // Default in partytracks is NODE_ENV==="production" only — Functions
            // often don't set that, so lock must be forced on explicitly.
            lockSessionToInitiator: true,
            request: fetchRequest,
        });
        res.status(response.status);
        response.headers.forEach((value, key) => {
            if (key.toLowerCase() === "set-cookie")
                return;
            res.setHeader(key, value);
        });
        // Headers.forEach comma-joins repeated Set-Cookie values — use getSetCookie.
        const setCookies = response.headers.getSetCookie?.() ?? [];
        const origin = req.get("origin") || "";
        const isLocalHttp = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) ||
            /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(req.get("referer") || "");
        for (const cookie of setCookies) {
            // partytracks always sets Secure; browsers on http://localhost drop it.
            // Strip Secure only for local Vite so session-lock still works in dev.
            const adjusted = isLocalHttp ? cookie.replace(/;\s*Secure/gi, "") : cookie;
            res.append("set-cookie", adjusted);
        }
        const buf = Buffer.from(await response.arrayBuffer());
        res.send(buf);
    }
    catch (error) {
        v2_1.logger.error("realtimeProxy error", error);
        res.status(500).send("Internal error");
    }
});
