# Prompt for another AI: Live Classes module — student_portal

Copy everything below this line into a fresh conversation with the other AI. It is self-contained — the AI doesn't need this conversation's history.

---

## Who you're working for and what this project is

You are working in `student_portal/`, a React 18 + Vite + TypeScript + Firebase (Firestore/Auth/Storage/Cloud Functions v2) web app. It's the student-facing learning portal for **Karthikeyan Analysis Study Circle (KASC)**, a Tamil Nadu coaching institute for TNPSC/TRB government-exam preparation. The app already has a full CBT (computer-based test) exam engine, batch/student management, media library, enrollment workflows, etc. The frontend deploys to **Vercel**; the backend is **Firebase** (Cloud Functions v2, Firestore, Storage). Do not touch the sibling `website/` directory (the separate marketing/ecommerce site) — this task is `student_portal/` only.

## The task

Build a full "Live Classes" module into this portal. Original client requirement (verbatim):

> **1. Meeting Management** — Create unlimited class meeting links. Separate meeting link for each subject. Multiple meeting links can remain active simultaneously. Meeting becomes active only after the Host or Co-Host joins. Only enrolled students can join the meeting. One device login restriction per student.
>
> **2. Host & Co-Host Management** — Roles: Host, Co-Host. Control panel: Mute/Unmute participants, Enable/Disable participant video, Screen Sharing, Start/Stop Meeting Recording, Remove students from the meeting, Control student screen viewing/display, meeting management controls.
>
> **3. Recording Module** — Host/Co-Host can start or stop recording. Subject-wise recording management. Automatic recording storage. Recording available in the student dashboard immediately after class ends.
>
> **4. Student Module** — Secure student login. Join only enrolled classes. Student can raise/point out doubts during class, visible only to Host and Co-Host. Attendance tracking. One active device per student.
>
> **5. Attendance Management** — Automatic attendance tracking, records per class, report generation.
>
> **6. Live Test Module** — Conduct live tests during ongoing classes. Students automatically participate after joining. Test interface displayed during live test. Teacher-controlled test management.
>
> **7. Security Features** — Enrolled students only, one device login restriction, subject-wise meeting access, secure meeting links, host-controlled participant management.

## Architecture decision already made (do not re-litigate without cause)

**The client explicitly refused to pay for or use any third-party video-conferencing SaaS (100ms, Agora, Daily, etc.).** They are already committed to **Cloudflare** (for R2 storage) and **Firebase** (existing backend). The video engine is built on:

- **Cloudflare Realtime SFU + TURN** (formerly "Cloudflare Calls") — free up to 1,000GB egress/month combined, then $0.05/GB. This is a real WebRTC media relay; Firestore alone cannot do this (no SFU, no TURN — P2P mesh WebRTC doesn't scale past ~4 participants and fails on many real-world networks without TURN).
- **`partytracks`** (npm package, MIT-ish license, maintained by Cloudflare, used in their own reference app `github.com/cloudflare/meet` / "Orange Meets") — wraps the raw Cloudflare Realtime session/track/renegotiation REST API into RxJS observables + React hooks. This is NOT a full "meeting platform" like 100ms — it's a lower-level media transport library. Rooms, roles, permissions, doubts, attendance, recording — all of that is hand-built in Firestore + this app's own code, not provided by the library.
- **Cloudflare R2** for durable recording storage (bucket `kasc-live-class-recordings`, already created, Asia-Pacific region — appropriate since all users are in Tamil Nadu).
- Everything else — enrollment gating, one-device session lock, exam-engine reuse for live tests, Excel exports — reuses existing patterns already in this codebase (see "Code you must reuse" below).

**Known, accepted tradeoffs of this architecture** (do not "fix" these without asking — they were explicitly discussed and accepted by the client):
1. **No server-side enforcement of mute/remove.** Cloudflare Realtime has no role/permission concept — it just relays whatever tracks a session publishes. "Host mutes a student" is implemented as: host writes a flag on the student's Firestore presence doc, and the student's own client honors it. A tampered client could ignore it. What Cloudflare's proxy *does* enforce: only the browser that created a session can act on it (signed-cookie check), preventing cross-student session hijacking.
2. **Recording is client-side capture, not a managed service.** The host's browser captures their own screen (`getDisplayMedia()`) mixed with their own mic (via Web Audio API — tab-audio capture alone does NOT include local mic input), records with `MediaRecorder`, and uploads to R2 via a presigned PUT URL on stop. Quality/reliability depends on the host's device staying awake and foregrounded. If their browser crashes mid-class, the recording is lost.
3. **Access gating IS still fully server-enforced** — just relocated to a Cloud Function proxy instead of a third-party SDK's server, so this part is NOT weakened (see `realtimeProxy` below).

## Verified technical facts (do not re-derive these — they came from reading actual package source and API docs; getting them wrong wastes hours)

**`partytracks` package** (`npm install partytracks`, latest is `0.0.56` — check for newer, it's pre-1.0 and evolving):
- `"type": "module"` — **pure ESM, no CJS build.** If your Cloud Functions project is CommonJS (check `functions/package.json` `"type"` field and `functions/tsconfig.json` `"module"` setting), you CANNOT `import ... from "partytracks/server"` at the top of a file — TypeScript will error, and even if it didn't, Node would throw `ERR_REQUIRE_ESM`. Fix: use a **dynamic import** inside the async function body: `const { routePartyTracksRequest } = await import("partytracks/server");`. This works fine from CJS and is what this project's `functions/src/liveClasses/realtimeProxy.ts` already does — copy that pattern.
- Three subpath exports: `partytracks/client`, `partytracks/react`, `partytracks/server`.
- **Client API** (`partytracks/client`):
  - `getMic()`, `getCamera()`, `getScreenshare()` — device managers, each returning an object with `.broadcastTrack$` (Observable<MediaStreamTrack>, always emits *something* even when not broadcasting — a fallback empty track, so don't use "is there a track" to detect on/off state), `.isBroadcasting$` (Observable<boolean> — use THIS for on/off state), `.toggleBroadcasting()`, `.isSourceEnabled$`, `.disableSource()` (also releases hardware — call on cleanup/unmount).
  - `getScreenshare()` returns `{ video, audio }`, each a broadcast-track-like object with the same shape, plus a combined `.isBroadcasting$`/`.toggleBroadcasting()` for both together.
  - `new PartyTracks(config?)` — the main class. Config: `{ prefix?: string, headers?: Headers, apiExtraParams?: string, iceServers?: RTCIceServer[] }`. `prefix` is the path your server-side proxy is mounted at (can be a full cross-origin URL, but see the cookie warning below). `apiExtraParams` is a literal query string appended to every request — useful for passing e.g. `classId=xxx` without hand-building URLs.
  - `partyTracks.push(sourceTrack$: Observable<MediaStreamTrack>): Observable<TrackMetadata>` — publishes a track, emits `{ sessionId, trackName }` you must broadcast to other participants (we do this via a Firestore presence doc — see Data model below).
  - `partyTracks.pull(trackData$: Observable<TrackMetadata>): Observable<MediaStreamTrack>` — subscribes to a remote track given its `{ sessionId, trackName, location: "remote" }`.
  - `partyTracks.session$: Observable<{ peerConnection, sessionId }>` — your own session id, needed for your presence doc.
- **React API** (`partytracks/react`): `useObservableAsValue(observable, defaultValue?)`, `useObservable(observable, observerOrNext)`, `useValueAsObservable(value)`. Standard RxJS-React bridging. **The passed Observable must be stable/memoized** (`useMemo`) or you'll re-subscribe every render.
- **Server API** (`partytracks/server`): `routePartyTracksRequest({ appId, token, request: Request, prefix?, turnServerAppId?, turnServerAppToken?, lockSessionToInitiator? })` — a ready-made proxy handler using the standard Fetch API `Request`/`Response` (not Express-specific). It:
  - Forwards to `https://rtc.live.cloudflare.com/v1` by default, adding `Authorization: Bearer <token>`.
  - Handles `${prefix}/generate-ice-servers` specially — returns free public Cloudflare STUN by default, or real TURN credentials if `turnServerAppId`/`turnServerAppToken` are supplied (**strongly recommended** — STUN-only fails on a meaningful fraction of real-world networks, especially mobile data and restrictive campus/office wifi, which is exactly what Tamil Nadu students will often be on).
  - Sets a `SameSite=Strict` signed-JWT cookie on session creation to lock that session to the browser that created it (prevents session hijacking). **This cookie will silently fail to be sent back on cross-origin requests** — your frontend must call this proxy same-origin (see Vercel rewrite below), not directly at the raw `*.cloudfunctions.net` URL.
  - If you build your own Express↔Fetch adapter around it (necessary if your backend is Firebase Functions, not Cloudflare Workers): construct a `Request` from the incoming path+query+method+headers+raw body, call `routePartyTracksRequest`, then translate the returned `Response` back — **watch out for `Set-Cookie`**: iterating `response.headers.forEach()` comma-joins multiple `Set-Cookie` values (corrupts them); use `response.headers.getSetCookie()` (Node 18+) instead and `res.append("set-cookie", ...)` per value.
  - Also uncertain: whether the framework strips your Cloud Function's own name from the incoming request path before your handler sees it. Defend against both cases (strip a literal `/yourFunctionName` prefix if present, and use `prefix: ""` in the config either way) rather than assuming one behavior.

**Cloudflare dashboard setup** (the client must do this themselves — external account/billing):
1. Realtime → SFU → Create → gives an **App ID + App Token**.
2. Realtime → TURN → Create (separate app, same billing pool) → gives a **separate App ID + App Token** for TURN credential vending. Optional but strongly recommended (see above).
3. R2 → bucket already created (`kasc-live-class-recordings`) + API token already created (Object Read & Write, scoped to that bucket). Endpoint format: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, region `auto`.
4. **100ms's dashboard does NOT support a custom S3-compatible storage endpoint for recordings** (verified against their docs — only literal AWS S3/Alibaba OSS/GCS/Azure, no generic endpoint field) — this is moot now since 100ms isn't used at all, but it's *why* recording had to move to client-side capture + R2 rather than "point the video SDK's recording pipeline at R2 directly."

**AWS SDK v3 for R2** (R2 is S3-API-compatible): `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` for presigned GET (playback) and PUT (upload) URLs. `getSignedUrl(s3Client, new PutObjectCommand({Bucket, Key, ContentType}), {expiresIn})`. A class-length recording comfortably fits under R2/S3's 5GB single-PUT limit — no multipart upload needed.

## Data model

`liveClasses/{id}` (Firestore):
```
name, subject, batchId, batchIds: string[]
hostUids: string[], coHostUids: string[]
status: "scheduled" | "active" | "ended"
scheduledAt?: string          // informational only
activeSince?, endedAt?
spotlightUid?: string          // presence doc id currently pinned for every viewer
liveTestId?, liveTestStartedAt?   // pointer into the existing exam engine (examTests collection)
recordingStatus?: "recording" | "uploading" | "ready" | "failed"
recordingKey?: string          // R2 object key
recordingDurationSec?, recordingSizeBytes?
createdBy, createdAt, updatedAt?
```

`liveClasses/{id}/presence/{uid}` — **live/ephemeral roster**, one doc per currently-connected participant, doc id = Firebase Auth uid:
```
role: "host" | "co-host" | "student"
name: string
sessionId: string                              // Cloudflare Realtime session id
audioTrack?: { sessionId, trackName }
videoTrack?: { sessionId, trackName }
screenshareVideoTrack?: { sessionId, trackName }
mutedByHost?: boolean          // cooperative flag — see tradeoff #1 above
videoDisabledByHost?: boolean
kicked?: boolean
updatedAt: string
```
Owned by the participant themselves (create/delete/update their own doc); a host/co-host may ONLY flip the three control-flag fields on someone else's doc — enforce via Firestore rule `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])`.

`liveClasses/{id}/attendance/{studentRecordId}` — **durable historical record**, separate from `presence`:
```
studentRecordId, studentUid, name
sessions: [{ joinedAt, leftAt }]
currentSessionJoinedAt?: string   // set while a session is open
totalDurationSec: number
lastJoinedAt?, lastLeftAt?
```
Written via a Firestore transaction on join (open a session) and leave (close it, compute duration, append to `sessions`).

`liveClasses/{id}/doubts/{doubtId}`:
```
studentRecordId, studentUid, studentName, text, createdAt
resolved?: boolean, resolvedBy?, resolvedAt?
```
Read: admin (host/co-host) or the doc's own `studentUid`. Create: any signed-in user creating their own doc (`request.resource.data.studentUid == request.auth.uid`).

## Backend — Cloud Functions (Firebase Functions v2)

Three functions total:

1. **`realtimeProxy`** (`onRequest`) — the only "video" backend function. Verifies the caller's Firebase ID token (`Authorization: Bearer <idToken>` header, `admin.auth().verifyIdToken`), reads `classId` from a query param, loads the `liveClasses` doc, checks the caller is host/co-host (must be an admin whose uid is in `hostUids`/`coHostUids`) OR an enrolled+active student (their student record's `batchId`/`batchIds` intersects the class's, student `status === "active"`) **and** the class `status === "active"` for students specifically (hosts don't need this check — they're the ones who flip it to active). Only after that passes does it forward to `routePartyTracksRequest` per the adapter notes above. Secrets: `CF_REALTIME_APP_ID`, `CF_REALTIME_APP_TOKEN`, `CF_TURN_APP_ID`, `CF_TURN_APP_TOKEN`.
2. **`getRecordingUploadUrl`** (`onCall`) — host/co-host only (same access check, reuse it — don't duplicate the logic inline, factor a shared `resolveCallerAccess(db, uid, classDoc)` helper used by both functions). Returns `{ url, key }` — a presigned R2 PUT URL and the object key it'll land at (`liveClasses/{classId}/{timestamp}.webm`). Secrets: the four `R2_*` ones.
3. **`getRecordingPlaybackUrl`** (`onCall`) — checks `recordingStatus === "ready"`, checks caller is admin or an enrolled student for that class, returns a presigned R2 GET URL with a multi-hour TTL (recordings must remain watchable indefinitely on repeat visits — this function gets called fresh every time the recording page loads, it's not a one-time link).

**No Firestore trigger is needed for room provisioning** — Cloudflare Realtime sessions are created on-demand per join via the proxy, there's nothing to pre-provision when a `liveClasses` doc is created.

**Class `status` flips to `"active"`** client-side: the moment a host/co-host's own presence is established (their `PartyTracks.session$` emits), their own already-admin-privileged client calls a plain Firestore `updateDoc` on the `liveClasses` doc — no Cloud Function needed for this, Firestore rules already permit `isAdmin()` writes to this collection.

## Frontend — file-by-file

Under `src/app/features/liveClasses/`:
- `types.ts` — `LiveClass`, `LiveClassPresence`, `LiveClassDoubt`, `LiveClassAttendance`, `PublishedTrack`, `ParticipantRole`.
- `liveClassBatchUtils.ts` — batch-id helpers, mirror the exam engine's `examBatchUtils.ts` pattern exactly (same function names/shapes: `getXBatchIds`, `xIncludesBatch`, `normalizeXBatchFields`).
- `liveClassAvailability.ts` — status-label helpers (event-driven: `scheduled → active → ended`, no time window like exams have).
- `liveClassApi.ts` — all Firestore CRUD: class create/list/subscribe/update/end/delete, spotlight, live-test launch/stop, attendance transactions (join/leave), doubts (add/subscribe/resolve), **presence** (upsert own / delete own / subscribe to roster / host-only control-flag setter). Mirror the exam engine's `examApi.ts` conventions closely (same import style, same `onSnapshot`-based subscribe-function pattern).
- `adminDirectory.ts` — lists admin accounts (`admins` collection) for the host/co-host picker in the create-class form.
- `realtimeClient.ts` — builds a `PartyTracks` instance per class-join: fetches the current Firebase ID token, sets it as a static `Authorization` header, `prefix` pointing at a same-origin path (e.g. `/api/realtime`), `apiExtraParams` carrying `classId`. **Note the token-expiry caveat**: the header is captured once at construction; Firebase ID tokens expire after ~1 hour, so a class running longer than that could see a later renegotiation call rejected — acceptable for typical class lengths, document it, don't over-engineer a refresh mechanism for v1.
- `useLiveClassPresence.ts` — the core hook. Given `{classId, uid, name, role}`: builds the PartyTracks client, acquires `getMic()`/`getCamera()`/`getScreenshare()`, pushes their broadcast tracks, writes/keeps-in-sync this participant's own presence doc, subscribes to the full presence roster, cleans up (delete presence doc + release devices) on unmount. Returns `{ partyTracks, connectError, isConnected, mic, camera, screenshare, roster, myPresence }`. Does NOT own class-level business logic (flipping status active, reacting to being kicked) — that's the calling page's job using the returned values.
- `recordingCapture.ts` — `startRecordingCapture({classId, onUploaded, onError})`: `getDisplayMedia()` + mixed-in mic via `AudioContext`/`createMediaStreamDestination` + `MediaRecorder` + upload-on-stop via `getRecordingUploadUrl` + `fetch(url, {method:"PUT", body: blob})`. Returns `{ stop() }`. Also auto-finishes if the browser's native "stop sharing" control is used (listen for the `ended` event on the display video track).
- `recordingPlayback.ts` — thin `httpsCallable` wrapper for `getRecordingPlaybackUrl`.

Under `src/app/components/liveClasses/`:
- `ParticipantVideoTile.tsx` — renders one presence doc's tile. Takes `{presence, partyTracks, isLocal?, localVideoTrack$?, localAudioTrack$?, spotlighted?, actions?}`. For the viewer's OWN tile, the caller passes `localVideoTrack$`/`localAudioTrack$` sourced from `camera.broadcastTrack$`/`mic.broadcastTrack$` **only while actually on** (the caller decides on/off via `isBroadcasting$`, not this component — remember `broadcastTrack$` always emits something even when off). Every other tile pulls via `partyTracks.pull()` from `presence.videoTrack`/`audioTrack`.

Pages:
- `pages/admin/LiveClassManagement.tsx` — list + create-dialog (name, subject, batch multi-select reusing the exam engine's `ExamBatchAssignmentFields` component, host/co-host checkboxes from `adminDirectory.ts`), end/delete actions, links to room + attendance.
- `pages/admin/LiveClassRoom.tsx` — full-screen (not inside the dashboard sidebar layout — same reasoning as the exam-taking page: needs the whole viewport). Outer component loads the class doc + determines the caller's role (host/co-host/denied) before mounting the inner component that actually calls `useLiveClassPresence` (avoids calling that hook with an unresolved role). Control bar: mic/camera/screenshare toggle, record start/stop, live-test launch (reuses the exam engine's test list, filtered to `status==="published"` + batch overlap), leave, end-for-everyone. Per-tile host actions: mute/disable-video/spotlight/remove, all writing to that participant's presence doc. Doubts side panel.
- `pages/student/LiveClasses.tsx` — list of classes for the student's active batch (live-now / waiting / ended-with-recording), inside the normal dashboard layout.
- `pages/student/LiveClassJoin.tsx` — full-screen. Gates on `status === "active"` (shows "waiting for host" otherwise), joins via `useLiveClassPresence` with role `"student"`, honors `mutedByHost`/`videoDisabledByHost`/`kicked` from `myPresence` (auto-stop the relevant track / navigate away), records attendance join/leave tied to `isConnected`, redirects into the existing exam-taking route the moment `cls.liveTestId` is set, doubt submission box.
- `pages/student/LiveClassRecording.tsx` — protected playback page, clone the content-protection pattern (right-click/devtools-shortcut blocking, tab-blur pause, speed selector) already used by this app's pre-recorded `VideoPlayer.tsx` page, but resolve the URL via `recordingPlayback.ts` instead of a Firebase Storage signed URL. **Do not claim any encryption/watermarking that isn't actually implemented** — this app's older `VideoPlayer.tsx` has some copy that overstates its own protection; don't copy that mistake, only claim what's real (a private, access-checked, expiring presigned URL).
- `pages/admin/LiveClassAttendance.tsx` — per-class attendance table (enrolled students × attended/not, time-in-class) + Excel export via `xlsx` (this codebase already uses `xlsx` extensively elsewhere for exports — match that pattern).

Routing/nav: register admin routes under `/admin/live-classes` (list/create inside the normal admin dashboard layout; `/admin/live-classes/:id/room` as a full-screen top-level route) and student routes under `/student/live-classes` (list inside the normal layout; `/student/live-classes/:id` full-screen, `/student/live-classes/:id/recording` inside the normal layout). Add sidebar nav entries for both roles.

`vercel.json` — add a rewrite so `/api/realtime/:path*` transparently proxies to the deployed `realtimeProxy` Cloud Function URL (`https://us-central1-<PROJECT_ID>.cloudfunctions.net/realtimeProxy/:path*` — confirm the actual region/project id from `.firebaserc` and whether any function-level region override was added). **Must come before** the existing catch-all SPA rewrite in the rewrites array (first match wins).

## Firestore rules addition

Under the existing `liveClasses/{id}` match block, alongside `attendance`/`doubts`:
```
match /presence/{uid} {
  allow read: if isSignedIn();
  allow create, delete: if isOwner(uid);
  allow update: if isOwner(uid)
    || (isAdmin() && request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(["mutedByHost", "videoDisabledByHost", "kicked", "updatedAt"]));
}
```
(`isOwner`/`isAdmin`/`isSignedIn` are existing helper functions already defined near the top of this project's `firestore.rules` — reuse them, don't redefine.)

## Code you must reuse, not reinvent

This codebase already has, and you should study before writing anything new:
- `functions/src/index.ts` — existing `submitExamAttempt` Cloud Function shows the project's error-handling/style conventions for `onCall` functions.
- `src/app/features/exams/examApi.ts`, `examBatchUtils.ts`, `examAvailability.ts` — the exact conventions to mirror for the new `liveClass*` equivalents.
- `src/app/context/AuthContext.tsx` — existing one-device-session-lock mechanism for students (already covers "one active device per student" app-wide; don't build a second one for live classes).
- `src/app/components/exams/ExamBatchAssignmentFields.tsx` — reusable batch multi-select component.
- `src/app/pages/student/VideoPlayer.tsx` — content-protection pattern to clone for the recording playback page.
- `src/app/pages/admin/TestAttendanceAnalytics.tsx` — Excel export pattern via `xlsx`.
- Existing shadcn/ui component library at `src/app/components/ui/*` (Button, Card, Dialog, Table, Badge, Checkbox, Select, etc.) — use these, don't introduce a different UI kit.

## Manual setup the client must do (you cannot do this — no access to their accounts)

1. Firebase project must be on the **Blaze** (pay-as-you-go) plan — required for Cloud Functions to make outbound network calls at all.
2. Cloudflare Realtime SFU App + TURN App (see "Cloudflare dashboard setup" above) → four secrets.
3. `firebase functions:secrets:set CF_REALTIME_APP_ID` (repeat for the other three; R2 secrets are already set).
4. `firebase deploy --only firestore:rules,firestore:indexes,functions`.
5. Confirm/update the Vercel rewrite target once the function's real URL is known, then deploy the frontend.

## Verification checklist once deployed

- Two browser profiles (host + student): video/audio flow both directions; host mute/disable-video/remove visibly takes effect on the student's tile; spotlight forces the student's layout.
- A student outside the class's batch, or trying to join before the host has connected, is rejected — check this happens at the `realtimeProxy` level (Cloud Function logs), not just hidden by the UI.
- Start a recording, stop it, confirm the file lands in the R2 bucket (Cloudflare dashboard → bucket browser), confirm `getRecordingPlaybackUrl` produces a link that actually plays, and that it still plays on a second visit (fresh presigned URL each time, not a cached expiring one).
- Test on a mobile-data connection specifically, not just two laptops on the same wifi — this is the real test of whether the TURN app is actually configured and working, since same-network STUN-only connections will falsely appear to work fine.
- Launch a live test from the room; confirm a joined student gets redirected into the existing exam-taking flow and their attendance "leave" fires correctly (since navigating away disconnects the call by design — documented tradeoff, not a bug).
