import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { NEVER, catchError, of, timer, type Observable } from "rxjs";
import { mergeMap } from "rxjs/operators";
import type { PartyTracks, TrackMetadata } from "partytracks/client";
import { useObservableAsValue } from "partytracks/react";
import { Mic, MicOff, Monitor, User } from "lucide-react";
import type { LiveClassPresence, PublishedTrack } from "../../features/liveClasses/types";

function toTrackMetadata(t?: PublishedTrack): TrackMetadata | undefined {
  if (!t) return undefined;
  return { sessionId: t.sessionId, trackName: t.trackName, location: "remote" };
}

function pullSafe(
  partyTracks: PartyTracks,
  meta$: Observable<TrackMetadata>,
  label: string,
  peerName: string,
): Observable<MediaStreamTrack> {
  return partyTracks.pull(meta$).pipe(
    catchError((err, caught) => {
      console.warn(`[live-class] ${label} pull failed`, peerName, err);
      // Brief backoff then resubscribe — recovers after local/remote session rotation.
      return timer(1500).pipe(mergeMap(() => caught));
    }),
  );
}

/**
 * Renders one participant's tile. For the viewer's own tile, pass `isLocal`
 * plus local track observables sourced from mic/camera/screenshare
 * `broadcastTrack$` only while actually enabled. Remote tiles prefer
 * `screenshareVideoTrack` over camera `videoTrack` when the peer is sharing.
 *
 * Remote pulls are gated on `mediaReady` (local PeerConnection connected).
 * Pulling against a disconnected session is what produced Cloudflare's
 * tracks/new 410 "Session appears to be disconnected".
 */
export default function ParticipantVideoTile({
  presence,
  partyTracks,
  isLocal,
  mediaReady = true,
  localVideoTrack$,
  localAudioTrack$,
  localScreenshareTrack$,
  spotlighted,
  actions,
}: {
  presence: LiveClassPresence;
  partyTracks: PartyTracks;
  isLocal?: boolean;
  /** When false, skip remote SFU pulls (local preview still works). */
  mediaReady?: boolean;
  localVideoTrack$?: Observable<MediaStreamTrack>;
  localAudioTrack$?: Observable<MediaStreamTrack>;
  localScreenshareTrack$?: Observable<MediaStreamTrack>;
  spotlighted?: boolean;
  actions?: ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const canPull = !isLocal && mediaReady;

  const remoteScreenMeta$ = useMemo(() => {
    const meta = toTrackMetadata(presence.screenshareVideoTrack);
    return meta ? of(meta) : NEVER;
  }, [presence.screenshareVideoTrack?.sessionId, presence.screenshareVideoTrack?.trackName]);

  const remoteVideoMeta$ = useMemo(() => {
    const meta = toTrackMetadata(presence.videoTrack);
    return meta ? of(meta) : NEVER;
  }, [presence.videoTrack?.sessionId, presence.videoTrack?.trackName]);

  const remoteAudioMeta$ = useMemo(() => {
    const meta = toTrackMetadata(presence.audioTrack);
    return meta ? of(meta) : NEVER;
  }, [presence.audioTrack?.sessionId, presence.audioTrack?.trackName]);

  const pulledScreen$ = useMemo(
    () => (canPull ? pullSafe(partyTracks, remoteScreenMeta$, "screenshare", presence.name) : NEVER),
    [canPull, partyTracks, remoteScreenMeta$, presence.name],
  );
  const pulledVideo$ = useMemo(
    () => (canPull ? pullSafe(partyTracks, remoteVideoMeta$, "video", presence.name) : NEVER),
    [canPull, partyTracks, remoteVideoMeta$, presence.name],
  );
  const pulledAudio$ = useMemo(
    () => (canPull ? pullSafe(partyTracks, remoteAudioMeta$, "audio", presence.name) : NEVER),
    [canPull, partyTracks, remoteAudioMeta$, presence.name],
  );

  const localScreenTrack = useObservableAsValue(localScreenshareTrack$ ?? NEVER);
  const localCamTrack = useObservableAsValue(localVideoTrack$ ?? NEVER);
  const pulledScreen = useObservableAsValue(pulledScreen$);
  const pulledVideo = useObservableAsValue(pulledVideo$);
  const audioTrack = useObservableAsValue(isLocal ? (localAudioTrack$ ?? NEVER) : pulledAudio$);

  const isSharing = isLocal ? !!localScreenTrack : !!presence.screenshareVideoTrack;
  const videoTrack = isLocal
    ? localScreenTrack || localCamTrack
    : pulledScreen || pulledVideo;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (videoTrack) {
      const ms = new MediaStream();
      ms.addTrack(videoTrack);
      el.srcObject = ms;
    } else {
      el.srcObject = null;
    }
  }, [videoTrack]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || isLocal) return; // never play our own audio back to ourselves
    if (audioTrack) {
      const ms = new MediaStream();
      ms.addTrack(audioTrack);
      el.srcObject = ms;
    } else {
      el.srcObject = null;
    }
  }, [audioTrack, isLocal]);

  const hasVideo = !!videoTrack;
  const hasAudio = !!audioTrack;

  return (
    <div
      className={`relative aspect-video overflow-hidden rounded-xl bg-slate-900 ${
        spotlighted ? "ring-4 ring-indigo-500" : ""
      }`}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          muted={!!isLocal}
          playsInline
          className={`h-full w-full ${isSharing ? "object-contain bg-black" : "object-cover"}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-500">
          <User className="h-10 w-10" />
        </div>
      )}
      {!isLocal ? <audio ref={audioRef} autoPlay /> : null}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-2.5 py-1.5">
        <span className="truncate text-xs font-medium text-white">
          {presence.name}
          {isLocal ? " (You)" : ""} · {presence.role}
          {isSharing ? " · Screen" : ""}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {isSharing ? <Monitor className="h-3.5 w-3.5 text-indigo-300" /> : null}
          {presence.mutedByHost ? (
            <MicOff className="h-3.5 w-3.5 text-red-400" />
          ) : hasAudio ? (
            <Mic className="h-3.5 w-3.5 text-white" />
          ) : (
            <MicOff className="h-3.5 w-3.5 text-slate-400" />
          )}
        </span>
      </div>
      {actions ? <div className="absolute right-1.5 top-1.5 flex gap-1">{actions}</div> : null}
    </div>
  );
}
