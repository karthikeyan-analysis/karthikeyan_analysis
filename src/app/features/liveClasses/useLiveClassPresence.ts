import { useEffect, useMemo, useState } from "react";
import { NEVER } from "rxjs";
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
 * Owns the local device tracks, the Cloudflare Realtime connection, and this
 * participant's own presence doc (the thing every other client reads to know
 * what to render/pull). Does not own class-level business logic (flipping
 * `liveClasses.status` to "active", reacting to being kicked) — that's
 * page-specific and handled by the caller using the returned `myPresence`.
 */
export function useLiveClassPresence(params: {
  classId: string;
  uid: string;
  name: string;
  role: ParticipantRole;
}) {
  const { classId, uid, name, role } = params;

  const [partyTracks, setPartyTracks] = useState<PartyTracks | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPartyTracks(null);
    setConnectError(null);
    createPartyTracksClient(classId)
      .then((pt) => {
        if (!cancelled) setPartyTracks(pt);
      })
      .catch((err) => {
        if (!cancelled) setConnectError(err?.message || "Could not connect to the class.");
      });
    return () => {
      cancelled = true;
    };
  }, [classId]);

  const mic = useMemo(() => getMic(), []);
  const camera = useMemo(() => getCamera(), []);
  const screenshare = useMemo(() => getScreenshare(), []);

  // Turn mic + camera on when joining so remote peers can see/hear without
  // an extra click (users can still mute from the control bar).
  useEffect(() => {
    if (!partyTracks) return;
    try {
      mic.enableSource();
      camera.enableSource();
      mic.startBroadcasting();
      camera.startBroadcasting();
    } catch (err) {
      console.warn("Could not auto-enable mic/camera", err);
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
  const sessionError$ = useMemo(() => partyTracks?.sessionError$ ?? NEVER, [partyTracks]);
  const isScreenOn = useObservableAsValue(screenshare.isBroadcasting$, false);

  const audioMeta$ = useMemo(
    () => (partyTracks ? partyTracks.push(mic.broadcastTrack$) : NEVER),
    [partyTracks, mic],
  );
  const videoMeta$ = useMemo(
    () => (partyTracks ? partyTracks.push(camera.broadcastTrack$) : NEVER),
    [partyTracks, camera],
  );
  // Only push screenshare while actively sharing — idle screenshare pushes
  // were a common source of tracks/new 400 noise.
  const screenMeta$ = useMemo(
    () =>
      partyTracks && isScreenOn
        ? partyTracks.push(screenshare.video.broadcastTrack$)
        : NEVER,
    [partyTracks, screenshare, isScreenOn],
  );

  const session = useObservableAsValue(session$);
  const sessionError = useObservableAsValue(sessionError$);
  const audioMeta = useObservableAsValue(audioMeta$);
  const videoMeta = useObservableAsValue(videoMeta$);
  const screenMeta = useObservableAsValue(screenMeta$);

  useEffect(() => {
    if (sessionError) {
      setConnectError(sessionError);
    }
  }, [sessionError]);

  const isMicOn = useObservableAsValue(mic.isBroadcasting$, false);
  const isCameraOn = useObservableAsValue(camera.isBroadcasting$, false);

  // Keep our own presence doc in sync with the current session + published tracks.
  useEffect(() => {
    if (!session?.sessionId) return;
    upsertOwnPresence({
      classId,
      uid,
      role,
      name,
      sessionId: session.sessionId,
      audioTrack: isMicOn ? toPublishedTrack(audioMeta) : null,
      videoTrack: isCameraOn ? toPublishedTrack(videoMeta) : null,
      screenshareVideoTrack: isScreenOn ? toPublishedTrack(screenMeta) : null,
    }).catch(console.error);
  }, [
    classId,
    uid,
    role,
    name,
    session?.sessionId,
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
    isConnected: !!session?.sessionId,
    mic,
    camera,
    screenshare,
    roster,
    myPresence,
  };
}
