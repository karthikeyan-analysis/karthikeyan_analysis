import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NEVER, Observable, EMPTY, catchError, distinctUntilChanged, shareReplay, switchMap } from "rxjs";
import { PartyTracks, getMic, getCamera, getScreenshare, type TrackMetadata } from "partytracks/client";
import { useObservableAsValue } from "partytracks/react";
import { createPartyTracksClient } from "./realtimeClient";
import { deleteOwnPresence, subscribeToPresence, upsertOwnPresence } from "./liveClassApi";
import type { LiveClassPresence, ParticipantRole, PublishedTrack } from "./types";

function toPublishedTrack(meta: TrackMetadata | undefined): PublishedTrack | null {
  if (!meta?.sessionId || !meta?.trackName) return null;
  return { sessionId: meta.sessionId, trackName: meta.trackName };
}

/**
 * partytracks' peerConnectionState$ only emits on connectionstatechange and
 * skips the initial state — so UI would stay "connecting" forever if we
 * subscribed after the PC was already connected. Emit current state first.
 */
function peerConnectionState$(partyTracks: PartyTracks): Observable<RTCPeerConnectionState> {
  return partyTracks.peerConnection$.pipe(
    switchMap((pc) =>
      new Observable<RTCPeerConnectionState>((subscriber) => {
        subscriber.next(pc.connectionState);
        const handler = () => subscriber.next(pc.connectionState);
        pc.addEventListener("connectionstatechange", handler);
        return () => pc.removeEventListener("connectionstatechange", handler);
      }),
    ),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}
export function useLiveClassPresence(params: {
  classId: string;
  uid: string;
  name: string;
  role: ParticipantRole;
}) {
  const { classId, uid, name, role } = params;

  const [reconnectToken, setReconnectToken] = useState(0);
  const [partyTracks, setPartyTracks] = useState<PartyTracks | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const disposeClientRef = useRef<(() => void) | null>(null);
  /** Holds session$ so the PeerConnection stays alive and closes on leave. */
  const sessionHoldRef = useRef<{ unsubscribe: () => void } | null>(null);

  const reconnect = useCallback(() => {
    setConnectError(null);
    setReconnectToken((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPartyTracks(null);
    setConnectError(null);

    createPartyTracksClient(classId)
      .then((handle) => {
        if (cancelled) {
          handle.dispose();
          return;
        }
        disposeClientRef.current = handle.dispose;

        // Keep one subscription on session$ for the lifetime of this join.
        // shareReplay(refCount) closes the PeerConnection when this unsubscribes
        // and no push/pull subscribers remain — critical on leave/remount.
        sessionHoldRef.current = handle.partyTracks.session$.subscribe({
          error: (err) => {
            if (cancelled) return;
            const message =
              err instanceof Error ? err.message : "Could not establish a media session.";
            setConnectError(message);
          },
        });

        setPartyTracks(handle.partyTracks);
      })
      .catch((err) => {
        if (!cancelled) {
          setConnectError(err?.message || "Could not connect to the class.");
        }
      });

    return () => {
      cancelled = true;
      sessionHoldRef.current?.unsubscribe();
      sessionHoldRef.current = null;
      disposeClientRef.current?.();
      disposeClientRef.current = null;
    };
  }, [classId, reconnectToken]);

  const mic = useMemo(() => getMic(), []);
  const camera = useMemo(() => getCamera(), []);
  const screenshare = useMemo(() => getScreenshare(), []);

  // Turn mic + camera on when joining so remote peers can see/hear without
  // an extra click (users can still mute from the control bar).
  // Wait until partyTracks exists so the first push uses live tracks and
  // completes SDP — that is what brings PeerConnection to "connected".
  useEffect(() => {
    try {
      mic.enableSource();
      camera.enableSource();
    } catch (err) {
      console.warn("Could not auto-enable mic/camera sources", err);
    }
  }, [mic, camera]);

  useEffect(() => {
    if (!partyTracks) return;
    try {
      mic.startBroadcasting();
      camera.startBroadcasting();
    } catch (err) {
      console.warn("Could not auto-start broadcasting", err);
    }
  }, [partyTracks, mic, camera]);

  // Best-effort hardware release (camera/mic indicator lights) on leave.
  useEffect(() => {
    return () => {
      mic.disableSource();
      camera.disableSource();
      screenshare.disableSource();
    };
  }, [mic, camera, screenshare]);

  const session$ = useMemo(() => partyTracks?.session$ ?? NEVER, [partyTracks]);
  const pcState$ = useMemo(
    () => (partyTracks ? peerConnectionState$(partyTracks) : NEVER),
    [partyTracks],
  );
  const isMicOn = useObservableAsValue(mic.isBroadcasting$, false);
  const isCameraOn = useObservableAsValue(camera.isBroadcasting$, false);
  const isScreenOn = useObservableAsValue(screenshare.isBroadcasting$, false);

  const session = useObservableAsValue(session$);
  const connectionState = useObservableAsValue(pcState$, "new" as RTCPeerConnectionState);
  const isPcConnected = connectionState === "connected";

  const audioMeta$ = useMemo(
    () =>
      partyTracks && isMicOn
        ? partyTracks.push(mic.broadcastTrack$).pipe(catchError(() => EMPTY))
        : NEVER,
    [partyTracks, mic, isMicOn],
  );
  const videoMeta$ = useMemo(
    () =>
      partyTracks && isCameraOn
        ? partyTracks.push(camera.broadcastTrack$).pipe(catchError(() => EMPTY))
        : NEVER,
    [partyTracks, camera, isCameraOn],
  );
  const screenMeta$ = useMemo(
    () =>
      partyTracks && isScreenOn
        ? partyTracks.push(screenshare.video.broadcastTrack$).pipe(catchError(() => EMPTY))
        : NEVER,
    [partyTracks, screenshare, isScreenOn],
  );

  const audioMeta = useObservableAsValue(audioMeta$);
  const videoMeta = useObservableAsValue(videoMeta$);
  const screenMeta = useObservableAsValue(screenMeta$);

  // Recover automatically if partytracks brings the PC back before we give up.
  useEffect(() => {
    if (isPcConnected) setConnectError(null);
  }, [isPcConnected]);

  // Auto-reconnect as soon as device regains network connectivity
  useEffect(() => {
    const handleOnline = () => {
      setConnectError(null);
      reconnect();
    };
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [reconnect]);

  // If ICE dies or connection disconnects/fails, auto-retry first, then surface error after a grace period.
  useEffect(() => {
    if (!partyTracks) return;
    if (connectionState !== "failed" && connectionState !== "closed" && connectionState !== "disconnected") return;

    // First, attempt an automatic recovery reconnect after 3 seconds
    const autoRetryTimer = window.setTimeout(() => {
      if (connectionState === "disconnected" || connectionState === "failed") {
        reconnect();
      }
    }, 3000);

    const errorTimer = window.setTimeout(() => {
      if (connectionState === "failed" || connectionState === "closed" || connectionState === "disconnected") {
        setConnectError(
          "Media connection dropped due to network issues. Click 'Rejoin Class' to re-establish your live connection.",
        );
      }
    }, 7000);

    return () => {
      window.clearTimeout(autoRetryTimer);
      window.clearTimeout(errorTimer);
    };
  }, [connectionState, partyTracks, reconnect]);

  // Stuck in "new"/"connecting" usually means ICE/TURN or mic permission never completed.
  useEffect(() => {
    if (!partyTracks || isPcConnected || connectError) return;
    const t = window.setTimeout(() => {
      setConnectError(
        "Could not establish a media connection. Check your internet connection and try rejoining.",
      );
    }, 25000);
    return () => window.clearTimeout(t);
  }, [partyTracks, isPcConnected, connectError]);

  // Surface mic/camera permission failures instead of silently never connecting.
  useEffect(() => {
    if (!partyTracks) return;
    const toMessage = (err: Error) => {
      if (err.name === "NotAllowedError") {
        return "Camera or microphone permission was blocked. Allow access and try again.";
      }
      if (err.name === "NotFoundError") {
        return "No camera or microphone was found on this device.";
      }
      return err.message || "Could not access camera or microphone.";
    };
    const micSub = mic.error$.subscribe((err) => setConnectError(toMessage(err)));
    const camSub = camera.error$.subscribe((err) => setConnectError(toMessage(err)));
    const screenSub = screenshare.video.error$.subscribe((err) => {
      if (err.name !== "NotAllowedError") {
        console.warn("Screenshare error:", err);
      }
      screenshare.stopBroadcasting();
      screenshare.disableSource();
    });
    return () => {
      micSub.unsubscribe();
      camSub.unsubscribe();
      screenSub.unsubscribe();
    };
  }, [partyTracks, mic, camera, screenshare]);

  // Keep our own presence doc in sync with the current session + published tracks.
  // Wait until the PeerConnection is connected so we never advertise tracks for a
  // session peers cannot pull from (which produced tracks/new 410 spam).
  useEffect(() => {
    if (!session?.sessionId) return;
    upsertOwnPresence({
      classId,
      uid,
      role,
      name,
      sessionId: session.sessionId,
      audioTrack: isMicOn && isPcConnected ? toPublishedTrack(audioMeta) : null,
      videoTrack: isCameraOn && isPcConnected ? toPublishedTrack(videoMeta) : null,
      screenshareVideoTrack: isScreenOn && isPcConnected ? toPublishedTrack(screenMeta) : null,
    }).catch(console.error);
  }, [
    classId,
    uid,
    role,
    name,
    session?.sessionId,
    isPcConnected,
    isMicOn,
    isCameraOn,
    isScreenOn,
    audioMeta?.sessionId,
    audioMeta?.trackName,
    videoMeta?.sessionId,
    videoMeta?.trackName,
    screenMeta?.sessionId,
    screenMeta?.trackName,
  ]);

  // Remove our presence doc the moment we leave, regardless of why.
  useEffect(() => {
    return () => {
      deleteOwnPresence(classId, uid).catch(() => {});
    };
  }, [classId, uid]);

  const [roster, setRoster] = useState<LiveClassPresence[]>([]);
  useEffect(() => subscribeToPresence(classId, setRoster), [classId]);

  const myPresence = roster.find((p) => p.id === uid) ?? null;

  return {
    partyTracks,
    connectError,
    reconnect,
    /** True only when WebRTC PeerConnection is actually connected (not merely session created). */
    isConnected: isPcConnected,
    connectionState,
    mic,
    camera,
    screenshare,
    isScreenOn,
    roster,
    myPresence,
  };
}
