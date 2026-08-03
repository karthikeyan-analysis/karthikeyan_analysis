import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import ExamBatchAssignmentFields, {
  inferExamBatchMode,
  type ExamBatchMode,
} from "../../components/exams/ExamBatchAssignmentFields";
import { Plus, Radio, Trash2, Users, Video, PlayCircle } from "lucide-react";
import { listAdmins, type AdminProfile } from "../../features/liveClasses/adminDirectory";
import {
  createLiveClass,
  deleteLiveClass,
  endLiveClass,
  subscribeToLiveClassesForAdmin,
  updateLiveClass,
} from "../../features/liveClasses/liveClassApi";
import { formatLiveClassBatchLabel } from "../../features/liveClasses/liveClassBatchUtils";
import { isHostOrCoHost, liveClassStatusLabel } from "../../features/liveClasses/liveClassAvailability";
import type { LiveClass } from "../../features/liveClasses/types";

function statusBadgeVariant(status: LiveClass["status"]): "default" | "secondary" | "outline" {
  if (status === "active") return "default";
  if (status === "ended") return "outline";
  return "secondary";
}

type ListFilter = "all" | "live" | "scheduled" | "ended" | "recordings";

export default function LiveClassManagement() {
  const { user } = useAuth();
  const { batches } = useData();
  const navigate = useNavigate();

  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [batchMode, setBatchMode] = useState<ExamBatchMode>("single");
  const [batchIds, setBatchIds] = useState<string[]>(() => (batches[0]?.id ? [batches[0].id] : []));
  const [hostUids, setHostUids] = useState<string[]>([]);
  const [coHostUids, setCoHostUids] = useState<string[]>([]);

  useEffect(() => {
    const unsub = subscribeToLiveClassesForAdmin((rows) => {
      setClasses(rows);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    listAdmins().then(setAdmins).catch(console.error);
  }, []);

  useEffect(() => {
    if (createOpen && user?.id && hostUids.length === 0) {
      setHostUids([user.id]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createOpen]);

  const allSubjects = useMemo(() => {
    const names = new Set<string>();
    for (const cls of classes) {
      const s = cls.subject?.trim();
      if (s) names.add(s);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [classes]);

  const subjectOptions = useMemo(() => {
    const names = new Set<string>();
    for (const id of batchIds) {
      const batch = batches.find((b) => b.id === id);
      for (const s of batch?.subjects || []) {
        const t = s.trim();
        if (t) names.add(t);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [batchIds, batches]);

  const filteredClasses = useMemo(() => {
    return classes.filter((cls) => {
      if (subjectFilter !== "all" && cls.subject !== subjectFilter) return false;
      if (listFilter === "live") return cls.status === "active";
      if (listFilter === "scheduled") return cls.status === "scheduled";
      if (listFilter === "ended") return cls.status === "ended";
      if (listFilter === "recordings") return cls.recordingStatus === "ready";
      return true;
    });
  }, [classes, listFilter, subjectFilter]);

  const recordingReadyCount = useMemo(
    () => classes.filter((c) => c.recordingStatus === "ready").length,
    [classes],
  );

  const resetForm = () => {
    setName("");
    setSubject("");
    setBatchMode("single");
    setBatchIds(batches[0]?.id ? [batches[0].id] : []);
    setHostUids(user?.id ? [user.id] : []);
    setCoHostUids([]);
  };

  const create = async () => {
    if (!name.trim()) return alert("Please enter a class name.");
    if (!subject.trim()) return alert("Please select or enter a subject.");
    if (!batchIds.length) return alert("Please select at least one batch.");
    if (!hostUids.length) return alert("Please assign at least one host.");
    if (!user?.id) return;

    setCreating(true);
    try {
      const cleanCoHosts = coHostUids.filter((id) => !hostUids.includes(id));
      const id = await createLiveClass({
        name: name.trim(),
        subject: subject.trim(),
        batchIds,
        hostUids,
        coHostUids: cleanCoHosts,
        createdBy: user.id,
      });
      // Activate immediately so students in the lobby can enter while the host connects.
      await updateLiveClass(id, {
        status: "active",
        activeSince: new Date().toISOString(),
      });
      setCreateOpen(false);
      resetForm();
      navigate(`/admin/live-classes/${id}/room`);
    } catch (e) {
      console.error(e);
      alert("Could not create the live class.");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this live class? This cannot be undone.")) return;
    try {
      await deleteLiveClass(id);
    } catch (e) {
      console.error(e);
      alert("Delete failed.");
    }
  };

  const end = async (id: string) => {
    if (!confirm("End this class for everyone?")) return;
    try {
      await endLiveClass(id);
    } catch (e) {
      console.error(e);
      alert("Could not end the class.");
    }
  };

  const startOrJoin = async (cls: LiveClass) => {
    try {
      if (cls.status !== "active" && cls.status !== "ended") {
        await updateLiveClass(cls.id, {
          status: "active",
          activeSince: new Date().toISOString(),
        });
      }
      navigate(`/admin/live-classes/${cls.id}/room`);
    } catch (e) {
      console.error(e);
      alert("Could not start the class. Please try again.");
    }
  };

  const filterButtons: { id: ListFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "live", label: "Live now" },
    { id: "scheduled", label: "Waiting" },
    { id: "ended", label: "Ended" },
    { id: "recordings", label: `Recordings (${recordingReadyCount})` },
  ];

  const liveCount = classes.filter((c) => c.status === "active").length;
  const waitingCount = classes.filter((c) => c.status === "scheduled").length;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">
            Create sessions, assign hosts, and manage recordings.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 ring-1 ring-emerald-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {liveCount} live
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600 ring-1 ring-slate-200/80">
              {waitingCount} waiting
            </span>
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700 ring-1 ring-indigo-100">
              {recordingReadyCount} recording{recordingReadyCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <Button
          className="bg-indigo-600 shadow-sm hover:bg-indigo-700"
          onClick={() => {
            resetForm();
            setCreateOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New Live Class
        </Button>
      </div>

      <Card className="border-slate-200/80 shadow-none">
        <CardContent className="space-y-4 pt-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-100/80 p-1">
              {filterButtons.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setListFilter(f.id)}
                  className={
                    listFilter === f.id
                      ? "rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                      : "rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="w-full lg:w-56">
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Filter by subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subjects</SelectItem>
                  {allSubjects.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
              Loading classes…
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Video className="h-6 w-6" />
              </div>
              <p className="font-medium text-slate-900">
                {classes.length === 0 ? "No live classes yet" : "No classes match these filters"}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                {classes.length === 0
                  ? "Create a class, assign a host or co-host, and share it with the selected batches."
                  : "Try another status or subject filter."}
              </p>
              {classes.length === 0 ? (
                <Button
                  className="mt-4 bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => {
                    resetForm();
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Create first class
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200/80">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="font-semibold text-slate-600">Name</TableHead>
                    <TableHead className="font-semibold text-slate-600">Subject</TableHead>
                    <TableHead className="font-semibold text-slate-600">Batch(es)</TableHead>
                    <TableHead className="font-semibold text-slate-600">Status</TableHead>
                    <TableHead className="font-semibold text-slate-600">Recording</TableHead>
                    <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClasses.map((cls) => {
                    const canControl = isHostOrCoHost(cls, user?.id);
                    return (
                      <TableRow key={cls.id} className="hover:bg-slate-50/60">
                        <TableCell className="font-medium text-slate-900">{cls.name}</TableCell>
                        <TableCell className="text-slate-700">{cls.subject}</TableCell>
                        <TableCell className="max-w-[180px] truncate text-sm text-slate-600">
                          {formatLiveClassBatchLabel(cls, batches)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={statusBadgeVariant(cls.status)}
                            className={
                              cls.status === "active"
                                ? "bg-emerald-600 hover:bg-emerald-600"
                                : undefined
                            }
                          >
                            {liveClassStatusLabel(cls)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {cls.recordingStatus === "ready" ? (
                            <span className="font-medium text-emerald-700">Ready</span>
                          ) : cls.recordingStatus === "uploading" ? (
                            <span className="text-amber-700">Uploading</span>
                          ) : cls.recordingStatus === "recording" ? (
                            <span className="text-amber-700">Recording</span>
                          ) : cls.recordingStatus === "failed" ? (
                            <span className="text-red-700">Failed</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="space-x-1.5 whitespace-nowrap text-right">
                          {cls.status !== "ended" && canControl ? (
                            <Button
                              size="sm"
                              className="bg-indigo-600 hover:bg-indigo-700"
                              onClick={() => void startOrJoin(cls)}
                            >
                              <Radio className="mr-1 h-3.5 w-3.5" />
                              {cls.status === "active" ? "Join Room" : "Start"}
                            </Button>
                          ) : null}
                          {cls.recordingStatus === "ready" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/admin/live-classes/${cls.id}/recording`)}
                            >
                              <PlayCircle className="mr-1 h-3.5 w-3.5" />
                              Watch
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/admin/live-classes/${cls.id}/attendance`)}
                          >
                            <Users className="mr-1 h-3.5 w-3.5" />
                            Attendance
                          </Button>
                          {cls.status === "active" && canControl ? (
                            <Button size="sm" variant="outline" onClick={() => void end(cls.id)}>
                              End
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => void remove(cls.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Live Class</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Class Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Statistics — Live Session 4"
              />
            </div>

            <ExamBatchAssignmentFields
              batches={batches.map((b) => ({ id: b.id, name: b.name }))}
              mode={batchMode}
              batchIds={batchIds}
              onModeChange={setBatchMode}
              onBatchIdsChange={(ids) => {
                setBatchIds(ids);
                setBatchMode(inferExamBatchMode(ids));
              }}
              hint="Only students enrolled in the selected batch(es) can join this class."
            />

            <div className="space-y-2">
              <Label>Subject</Label>
              {subjectOptions.length > 0 ? (
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjectOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Statistics" />
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Host(s)</Label>
                <button
                  type="button"
                  className="text-xs text-indigo-700 hover:underline"
                  onClick={() => navigate("/admin/co-hosts")}
                >
                  Manage co-hosts
                </button>
              </div>
              <div className="max-h-32 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-3">
                {admins.map((a) => (
                  <label key={a.uid} className="flex items-center gap-2.5 text-sm">
                    <Checkbox
                      checked={hostUids.includes(a.uid)}
                      onCheckedChange={(v) => {
                        if (v === true) {
                          setHostUids((prev) => [...new Set([...prev, a.uid])]);
                          setCoHostUids((prev) => prev.filter((id) => id !== a.uid));
                        } else {
                          setHostUids((prev) => prev.filter((id) => id !== a.uid));
                        }
                      }}
                    />
                    <span className="flex-1">
                      {a.name}
                      {a.kind === "cohost" ? (
                        <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wide text-indigo-600">
                          Co-Host login
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Co-Host(s) — optional, same controls as Host</Label>
              <p className="text-xs text-slate-500">
                Create co-host email/password accounts under Co-Host Management, then tick them here.
              </p>
              <div className="max-h-32 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-3">
                {admins
                  .filter((a) => !hostUids.includes(a.uid))
                  .map((a) => (
                    <label key={a.uid} className="flex items-center gap-2.5 text-sm">
                      <Checkbox
                        checked={coHostUids.includes(a.uid)}
                        onCheckedChange={(v) =>
                          setCoHostUids((prev) =>
                            v === true ? [...new Set([...prev, a.uid])] : prev.filter((id) => id !== a.uid),
                          )
                        }
                      />
                      <span className="flex-1">
                        {a.name}
                        {a.kind === "cohost" ? (
                          <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wide text-indigo-600">
                            Co-Host login
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                {admins.filter((a) => !hostUids.includes(a.uid)).length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No one left to assign. Create a co-host under Co-Host Management first.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => void create()} disabled={creating}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
