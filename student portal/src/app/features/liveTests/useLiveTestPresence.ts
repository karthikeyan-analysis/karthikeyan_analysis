import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NEVER, Observable, distinctUntilChanged, shareReplay, switchMap } from "rxjs";
import { PartyTracks, getMic, getCamera, getScreenshare, type TrackMetadata } from "partytracks/client";
import { useObservableAsValue } from "partytracks/react";
import { createPartyTracksClient } from "../liveClasses/realtimeClient";
import type { PublishedTrack } from "../liveClasses/types";
import {
  deleteLiveTestPresence,
  subscribeToLiveTestPresence,
  upsertLiveTestPresence,
} from "./liveTestApi";
import type { LiveTestPresence } from "./liveTestTypes";

function toPublishedTrack(meta: TrackMetadata | undefined): PublishedTrack | null {
  if (!meta?.sessionId || !meta?.trackName) return null;
  return { sessionId: meta.sessionId, trackName: meta.trackName };
}

function peerConnectionState$(partyTracks: PartyTracks): Observable<RTCPeerConnectionState> {
  return partyTracks.peerConnection$.pipe(
    switchMap(
      (pc) =>
        new Observable<RTCPeerConnectionState>((subscriber) => {
          subscriber.next(pc.connectionState);
          const onChange = () => subscriber.next(pc.connectionState);
          pc.addEventListener("connectionstatechange", onChange);
          return () => pc.removeEventListener("connectionstatechange", onChange);
        }),
    ),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}

export function useLiveTestPresence(params: {
  sessionId: string;
  uid: string;
  name: string;
  role: "admin" | "student";
  currentQuestionIndex?: number;
  totalAnswered?: number;
  totalQuestions?: number;
  isSubmitted?: boolean;
}) {
  const {
    sessionId,
    uid,
    name,
    role,
    currentQuestionIndex = 0,
    totalAnswered = 0,
    totalQuestions = 0,
    isSubmitted = false,
  } = params;

  const [partyTracks, setPartyTracks] = useState<PartyTracks | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [roster, setRoster] = useState<LiveTestPresence[]>([]);
  const [cameraStatus, setCameraStatus] = useState<"active" | "disabled" | "permission_denied">("active");

  const disposeClientRef = useRef<(() => void) | null>(null);
  const sessionHoldRef = useRef<{ unsubscribe: () => void } | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 3000;
    setPartyTracks(null);
    setConnectError(null);

    function attemptConnect() {
      createPartyTracksClient(sessionId)
        .then((handle) => {
          if (cancelled) {
            handle.dispose();
            return;
          }
          disposeClientRef.current = handle.dispose;

          sessionHoldRef.current = handle.partyTracks.session$.subscribe({
            error: (err) => {
              if (cancelled) return;
              const message = err instanceof Error ? err.message : "Media session connection error.";
              setConnectError(message);
            },
          });

          setPartyTracks(handle.partyTracks);
        })
        .catch((err) => {
          if (cancelled) return;
          const msg = err?.message || "";
          const isNotFound = msg.includes("not found") || msg.includes("404") || msg.includes("Class not found");

          if (isNotFound && retryCount < MAX_RETRIES) {
            // Session may not be propagated yet — retry silently
            retryCount++;
            retryTimer = setTimeout(() => { if (!cancelled) attemptConnect(); }, RETRY_DELAY_MS);
          } else if (isNotFound) {
            // Exhausted retries for a missing session — stay quiet
            setConnectError("Waiting for live test session...");
          } else {
            console.warn("[liveTest] WebRTC setup warning", err);
            setConnectError(msg || "Camera server connecting...");
          }
        });
    }

    attemptConnect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      sessionHoldRef.current?.unsubscribe();
      sessionHoldRef.current = null;
      disposeClientRef.current?.();
      disposeClientRef.current = null;
    };
  }, [sessionId]);

  const mic = useMemo(() => getMic(), []);
  const camera = useMemo(() => getCamera(), []);

  useEffect(() => {
    if (!partyTracks) return;
    try {
      if (role === "student") {
        camera.enableSource();
        camera.startBroadcasting();
        setCameraStatus("active");
      } else {
        // Admin
        mic.enableSource();
        camera.enableSource();
        mic.startBroadcasting();
        camera.startBroadcasting();
        setCameraStatus("active");
      }
    } catch (err) {
      console.warn("Camera auto-start error", err);
      setCameraStatus("permission_denied");
    }
  }, [partyTracks, mic, camera, role]);

  useEffect(() => {
    return () => {
      mic.disableSource();
      camera.disableSource();
    };
  }, [mic, camera]);

  const pcState$ = useMemo(
    () => (partyTracks ? peerConnectionState$(partyTracks) : NEVER),
    [partyTracks],
  );
  const connectionState = useObservableAsValue(pcState$, "new");

  const audioMeta$ = useMemo(
    () => (partyTracks && role === "admin" ? partyTracks.push(mic.broadcastTrack$) : NEVER),
    [partyTracks, mic, role],
  );
  const videoMeta$ = useMemo(
    () => (partyTracks ? partyTracks.push(camera.broadcastTrack$) : NEVER),
    [partyTracks, camera],
  );

  const audioTrackMeta = useObservableAsValue(audioMeta$, undefined);
  const videoTrackMeta = useObservableAsValue(videoMeta$, undefined);

  const audioTrack = useMemo(() => toPublishedTrack(audioTrackMeta), [audioTrackMeta]);
  const videoTrack = useMemo(() => toPublishedTrack(videoTrackMeta), [videoTrackMeta]);

  // Sync own presence
  useEffect(() => {
    if (!sessionId || !uid) return;

    void upsertLiveTestPresence(sessionId, uid, {
      name,
      role,
      audioTrack,
      videoTrack,
      cameraStatus,
      currentQuestionIndex,
      totalAnswered,
      totalQuestions,
      isSubmitted,
    });
  }, [
    sessionId,
    uid,
    name,
    role,
    audioTrack,
    videoTrack,
    cameraStatus,
    currentQuestionIndex,
    totalAnswered,
    totalQuestions,
    isSubmitted,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionId && uid) {
        void deleteLiveTestPresence(sessionId, uid);
      }
    };
  }, [sessionId, uid]);

  // Subscribe to roster
  useEffect(() => {
    if (!sessionId) return;
    const unsub = subscribeToLiveTestPresence(sessionId, (list) => {
      setRoster(list);
    });
    return unsub;
  }, [sessionId]);

  const myPresence = useMemo(
    () => roster.find((p) => p.uid === uid) || null,
    [roster, uid],
  );

  return {
    partyTracks,
    connectError,
    connectionState,
    mic,
    camera,
    roster,
    myPresence,
    cameraStatus,
  };
}
