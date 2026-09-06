/**
 * Live classes are event-driven, not window-driven like exams: there is no
 * startAt/endAt. A class becomes "active" the moment a host/co-host actually
 * joins the room (client flips status after PartyTracks session connects;
 * students are gated at realtimeProxy until then), and "ended" when a
 * host/co-host explicitly ends it. `scheduledAt` is informational only.
 */

import type { LiveClass } from "./types";

export function isLiveClassActive(cls: Pick<LiveClass, "status">): boolean {
  return cls.status === "active";
}

export function isLiveClassEnded(cls: Pick<LiveClass, "status">): boolean {
  return cls.status === "ended";
}

export function liveClassStatusLabel(cls: Pick<LiveClass, "status">): string {
  if (cls.status === "active") return "Live now";
  if (cls.status === "ended") return "Ended";
  return "Waiting for host";
}

/** UI-level gate only — realtimeProxy is the real enrollment/status enforcement. */
export function canStudentJoinLiveClass(cls: Pick<LiveClass, "status">): boolean {
  return cls.status === "active";
}

export function isHostOrCoHost(
  cls: Pick<LiveClass, "hostUids" | "coHostUids">,
  uid: string | undefined | null,
): boolean {
  if (!uid) return false;
  return cls.hostUids.includes(uid) || (cls.coHostUids || []).includes(uid);
}
