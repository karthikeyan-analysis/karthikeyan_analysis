import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NEVER, Observable, EMPTY, catchError, distinctUntilChanged, shareReplay, switchMap } from "rxjs";
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
  role: "admin" | "cohost" | "student";
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
    let retryCount = 0;
    const MAX_RETRIES = 12;
    const RETRY_DELAY_MS = 2500;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function attemptConnect() {
      if (cancelled) return;
      sessionHoldRef.current?.unsubscribe();
      sessionHoldRef.current = null;
      disposeClientRef.current?.();
      disposeClientRef.current = null;

      createPartyTracksClient(sessionId)
        .then((handle) => {
          if (cancelled) {
            handle.dispose();
            return;
          }
          disposeClientRef.current = handle.dispose;
          setPartyTracks(handle.partyTracks);
          setConnectError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          const msg = err instanceof Error ? err.message : String(err);
          const isNotFound = msg.includes("404") || msg.includes("not found");
          if (isNotFound && retryCount < MAX_RETRIES) {
            retryCount++;
            retryTimer = setTimeout(() => { if (!cancelled) attemptConnect(); }, RETRY_DELAY_MS);
          } else if (isNotFound) {
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
    try {
      camera.enableSource();
      if (role === "admin" || role === "cohost") {
        mic.enableSource();
      }
      setCameraStatus("active");
    } catch (err) {
      console.warn("Camera auto-start error", err);
      setCameraStatus("permission_denied");
    }
  }, [mic, camera, role]);

  useEffect(() => {
    if (!partyTracks) return;
    try {
      if (role === "student") {
        camera.startBroadcasting();
      } else {
        mic.startBroadcasting();
        camera.startBroadcasting();
      }
    } catch (err) {
      console.warn("Camera broadcasting start error", err);
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
  const isPcConnected = connectionState === "connected";

  const audioMeta$ = useMemo(
    () =>
      partyTracks
        ? partyTracks.push(mic.broadcastTrack$).pipe(catchError(() => EMPTY))
        : NEVER,
    [partyTracks, mic],
  );
  const videoMeta$ = useMemo(
    () =>
      partyTracks
        ? partyTracks.push(camera.broadcastTrack$).pipe(catchError(() => EMPTY))
        : NEVER,
    [partyTracks, camera],
  );

  const screenshare = useMemo(() => getScreenshare(), []);
  const isScreenOn = useObservableAsValue(screenshare.isBroadcasting$, false);

  const screenMeta$ = useMemo(
    () =>
      partyTracks && isScreenOn
        ? partyTracks.push(screenshare.video.broadcastTrack$).pipe(catchError(() => EMPTY))
        : NEVER,
    [partyTracks, screenshare, isScreenOn],
  );

  const audioTrackMeta = useObservableAsValue(audioMeta$, undefined);
  const videoTrackMeta = useObservableAsValue(videoMeta$, undefined);
  const screenTrackMeta = useObservableAsValue(screenMeta$, undefined);

  const audioTrack = useMemo(() => toPublishedTrack(audioTrackMeta), [audioTrackMeta]);
  const videoTrack = useMemo(() => toPublishedTrack(videoTrackMeta), [videoTrackMeta]);
  const screenshareVideoTrack = useMemo(() => toPublishedTrack(screenTrackMeta), [screenTrackMeta]);

  // Sync own presence
  useEffect(() => {
    if (!sessionId || !uid) return;

    void upsertLiveTestPresence(sessionId, uid, {
      name,
      role,
      audioTrack,
      videoTrack,
      screenshareVideoTrack: isScreenOn ? screenshareVideoTrack : null,
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
    screenshareVideoTrack,
    isScreenOn,
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
    screenshare,
    isScreenOn,
    roster,
    myPresence,
    cameraStatus,
  };
}
