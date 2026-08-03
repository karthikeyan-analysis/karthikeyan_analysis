import { PartyTracks } from "partytracks/client";
import { auth } from "../../../config/firebase";

/**
 * Same-origin path, proxied by a Vercel rewrite straight to the deployed
 * `realtimeProxy` Cloud Function. Same-origin matters here specifically
 * because Cloudflare's session-lock cookie (set by `routePartyTracksRequest`)
 * is `SameSite=Strict` — it would silently never be sent back on a
 * cross-origin request to the raw *.cloudfunctions.net URL.
 */
const REALTIME_PROXY_PATH = "/api/realtime";

type IceServer = RTCIceServer;

/**
 * partytracks fetches `/generate-ice-servers` WITHOUT apiExtraParams and
 * WITHOUT the custom Authorization header (it uses plain fromFetch, not the
 * instrumented fetch). Our proxy requires both → session setup always fails
 * and the class never becomes "active". Prefetch ICE ourselves, then pass
 * iceServers so partytracks skips that broken call.
 */
async function fetchIceServers(classId: string, idToken: string): Promise<IceServer[]> {
  const url = `${REALTIME_PROXY_PATH}/generate-ice-servers?classId=${encodeURIComponent(classId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      body.trim() ||
        `Could not get connection servers (HTTP ${res.status}). Check that live class credentials are configured.`,
    );
  }
  const data = (await res.json()) as { iceServers?: IceServer[] };
  if (!Array.isArray(data.iceServers) || data.iceServers.length === 0) {
    // STUN-only fallback so a TURN misconfig doesn't block the whole class.
    return [{ urls: "stun:stun.cloudflare.com:3478" }];
  }
  return data.iceServers;
}

/**
 * Creates a fresh PartyTracks client scoped to one class + one join. The
 * Firebase ID token is captured once, at construction time, as a static
 * header (the underlying config has no per-request auth hook). ID tokens
 * expire after ~1 hour — for a class running longer than that, a later
 * renegotiation call (e.g. a new participant joining) could be rejected by
 * realtimeProxy. Acceptable for typical class lengths; if hit, leaving and
 * rejoining the room picks up a fresh token.
 */
export async function createPartyTracksClient(classId: string): Promise<PartyTracks> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in.");
  const idToken = await user.getIdToken();

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${idToken}`);

  const iceServers = await fetchIceServers(classId, idToken);

  return new PartyTracks({
    prefix: REALTIME_PROXY_PATH,
    apiExtraParams: `classId=${encodeURIComponent(classId)}`,
    headers,
    iceServers,
  });
}
