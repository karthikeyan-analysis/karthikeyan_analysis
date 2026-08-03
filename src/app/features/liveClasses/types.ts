export type LiveClassStatus = "scheduled" | "active" | "ended";

export type ParticipantRole = "host" | "co-host" | "student";

export type RecordingStatus = "recording" | "uploading" | "ready" | "failed";

export interface LiveClass {
  id: string;
  name: string;
  subject: string;
  /** Primary batch (legacy). Same as the first entry in `batchIds`. */
  batchId: string;
  /** All batches that can access this class. */
  batchIds?: string[];
  /** Admin uids who can host with full control. */
  hostUids: string[];
  /** Admin uids who can co-host with the same control set as host. */
  coHostUids?: string[];
  status: LiveClassStatus;
  /** Informational only — the meeting only actually opens when a host/co-host joins. */
  scheduledAt?: string;
  activeSince?: string;
  endedAt?: string;
  /** Presence doc id (uid) currently pinned/forced full-screen for every student. */
  spotlightUid?: string;
  /** Pointer into the existing examTests engine for the Live Test Module. */
  liveTestId?: string;
  liveTestStartedAt?: string;
  recordingStatus?: RecordingStatus;
  /** Cloudflare R2 object key once the recording is ready. */
  recordingKey?: string;
  recordingDurationSec?: number;
  recordingSizeBytes?: number;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

/** A published Cloudflare Realtime track, addressable as `${sessionId}/${trackName}`. */
export interface PublishedTrack {
  sessionId: string;
  trackName: string;
}

/**
 * Live, ephemeral roster doc — one per currently-connected participant, doc id
 * === Firebase Auth uid. Owned/written by the participant themselves except for
 * the host-control flags (mutedByHost/videoDisabledByHost/kicked), which only a
 * host/co-host may set (enforced via Firestore rule field-level check). Since
 * Cloudflare Realtime has no server-side role/permission engine, these flags are
 * *cooperative* — honored by the owner's own client, not enforced by the SFU.
 */
export interface LiveClassPresence {
  /** Doc id === Firebase Auth uid */
  id: string;
  role: ParticipantRole;
  name: string;
  sessionId: string;
  audioTrack?: PublishedTrack;
  videoTrack?: PublishedTrack;
  screenshareVideoTrack?: PublishedTrack;
  mutedByHost?: boolean;
  videoDisabledByHost?: boolean;
  kicked?: boolean;
  updatedAt: string;
}

export interface LiveClassDoubt {
  id: string;
  studentRecordId: string;
  /** Firebase Auth uid of the student who raised it — used for the Firestore ownership rule. */
  studentUid: string;
  studentName: string;
  text: string;
  createdAt: string;
  resolved?: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface LiveClassAttendanceSession {
  joinedAt: string;
  leftAt: string;
}

export interface LiveClassAttendance {
  /** Doc id === studentRecordId */
  id: string;
  studentRecordId: string;
  studentUid: string;
  name: string;
  sessions: LiveClassAttendanceSession[];
  /** Set while the student currently has an open (not-yet-closed) session. */
  currentSessionJoinedAt?: string;
  totalDurationSec: number;
  lastJoinedAt?: string;
  lastLeftAt?: string;
}
