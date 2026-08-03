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

/** Refresh Firebase ID token before the ~1h expiry so long classes keep working. */
const TOKEN_REFRESH_MS = 45 * 60 * 1000;

type IceServer = RTCIceServer;

function iceUrls(server: IceServer): string[] {
  if (!server.urls) return [];
  return Array.isArray(server.urls) ? server.urls.map(String) : [String(server.urls)];
}

function hasTurnServer(servers: IceServer[]): boolean {
  return servers.some((s) => iceUrls(s).some((u) => /^turns?:/i.test(u)));
}

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
    throw new Error(
      "Live class media servers returned no ICE configuration. Confirm Cloudflare TURN secrets are set on realtimeProxy.",
    );
  }
  if (!hasTurnServer(data.iceServers)) {
    // STUN-only works on some LANs but fails on mobile / symmetric NAT — the
    // classic source of tracks/new 410 "Session appears to be disconnected".
    console.error(
      "[live-class] ICE servers have no TURN relay. WebRTC will fail for many students. Set CF_TURN_APP_ID / CF_TURN_APP_TOKEN on realtimeProxy.",
      data.iceServers,
    );
  }
  return data.iceServers;
}

export type PartyTracksClientHandle = {
  partyTracks: PartyTracks;
  /** Stop token refresh; call when leaving the room. Does not close the PC by itself. */
  dispose: () => void;
};

/**
 * Creates a fresh PartyTracks client scoped to one class + one join.
 * Authorization is kept on a mutable Headers object and refreshed on a timer
 * so classes longer than ~1 hour do not start failing renegotiation mid-call.
 */
export async function createPartyTracksClient(classId: string): Promise<PartyTracksClientHandle> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in.");
  const idToken = await user.getIdToken();

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${idToken}`);

  const iceServers = await fetchIceServers(classId, idToken);

  const partyTracks = new PartyTracks({
    prefix: REALTIME_PROXY_PATH,
    apiExtraParams: `classId=${encodeURIComponent(classId)}`,
    headers,
    iceServers,
  });

  const refreshTimer = window.setInterval(() => {
    const current = auth.currentUser;
    if (!current) return;
    void current
      .getIdToken(true)
      .then((fresh) => {
        headers.set("Authorization", `Bearer ${fresh}`);
      })
      .catch((err) => {
        console.warn("[live-class] Failed to refresh auth token for realtime", err);
      });
  }, TOKEN_REFRESH_MS);

  return {
    partyTracks,
    dispose: () => {
      window.clearInterval(refreshTimer);
    },
  };
}
