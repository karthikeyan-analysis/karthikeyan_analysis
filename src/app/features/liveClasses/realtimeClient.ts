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

  return new PartyTracks({
    prefix: REALTIME_PROXY_PATH,
    apiExtraParams: `classId=${encodeURIComponent(classId)}`,
    headers,
  });
}
