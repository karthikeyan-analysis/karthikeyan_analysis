import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Video, PlayCircle, Radio, Award, Zap } from "lucide-react";
import { subscribeToLiveClassesForStudentBatch } from "../../features/liveClasses/liveClassApi";
import { liveClassStatusLabel } from "../../features/liveClasses/liveClassAvailability";
import type { LiveClass } from "../../features/liveClasses/types";

function statusBadgeVariant(status: LiveClass["status"]): "default" | "secondary" | "outline" {
  if (status === "active") return "default";
  if (status === "ended") return "outline";
  return "secondary";
}

export default function LiveClasses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const subjectParam = searchParams.get("subject");
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState(subjectParam || "all");

  useEffect(() => {
    if (subjectParam) {
      setSubjectFilter(subjectParam);
    }
  }, [subjectParam]);

  useEffect(() => {
    if (!user?.batchId) {
      setLoading(false);
      return;
    }
    const unsub = subscribeToLiveClassesForStudentBatch(user.batchId, (rows) => {
      setClasses(rows);
      setLoading(false);
    });
    return unsub;
  }, [user?.batchId]);

  const subjects = useMemo(() => {
    const names = new Set<string>();
    for (const cls of classes) {
      const s = cls.subject?.trim();
      if (s) names.add(s);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [classes]);

  const filtered = useMemo(() => {
    if (subjectFilter === "all") return classes;
    return classes.filter((c) => c.subject?.toLowerCase() === subjectFilter.toLowerCase());
  }, [classes, subjectFilter]);

  const liveCount = classes.filter((c) => c.status === "active").length;

  const handleSubjectChange = (val: string) => {
    setSubjectFilter(val);
    if (val === "all") {
      searchParams.delete("subject");
    } else {
      searchParams.set("subject", val);
    }
    setSearchParams(searchParams, { replace: true });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">Join live sessions for your batch or watch recordings.</p>
          {liveCount > 0 ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {liveCount} class{liveCount === 1 ? "" : "es"} live now
            </p>
          ) : null}
        </div>
        {subjects.length > 0 ? (
          <div className="w-full sm:w-52">
            <Select value={subjectFilter} onValueChange={handleSubjectChange}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Filter by subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <Card className="border-slate-200/80 shadow-none">
        <CardContent className="pt-5">
          {loading ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
              Loading classes…
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Video className="h-6 w-6" />
              </div>
              <p className="font-medium text-slate-900">
                {classes.length === 0 ? "No live classes yet" : "No classes match this filter"}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                {classes.length === 0
                  ? "When your teacher starts a session for your batch, it will appear here."
                  : "Try another subject filter."}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((cls) => (
                <div
                  key={cls.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3.5 ${cls.status === "active"
                      ? "border-emerald-200/80 bg-emerald-50/40"
                      : "border-slate-200 bg-white"
                    }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {cls.status === "active" ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">
                          <Radio className="mr-1 h-3 w-3" />
                          Live
                        </Badge>
                      ) : (
                        <Badge variant={statusBadgeVariant(cls.status)}>
                          {liveClassStatusLabel(cls)}
                        </Badge>
                      )}
                      {cls.liveTestId && cls.liveTestId !== "none" && (cls.liveTestStartedAt || (cls as any).liveTestActive) && cls.status === "active" ? (
                        <Badge className="bg-amber-600 hover:bg-amber-600 font-bold">
                          <Award className="mr-1 h-3 w-3 animate-pulse" />
                          Live Exam Active
                        </Badge>
                      ) : null}
                      <p className="truncate font-medium text-slate-900">{cls.name}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{cls.subject}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {cls.liveTestId && cls.liveTestId !== "none" && (cls.liveTestStartedAt || (cls as any).liveTestActive) && cls.status === "active" ? (
                      <Button
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700 font-bold shadow-sm"
                        onClick={() => navigate(`/student/tests/${cls.liveTestId}`)}
                      >
                        <Zap className="mr-1 h-3.5 w-3.5 fill-current" />
                        Take Live Test
                      </Button>
                    ) : null}
                    {cls.status !== "ended" ? (
                      <Button
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700"
                        onClick={() => navigate(`/student/live-classes/${cls.id}`)}
                      >
                        {cls.status === "active" ? "Join class" : "Enter lobby"}
                      </Button>
                    ) : cls.recordingStatus === "ready" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/student/live-classes/${cls.id}/recording`)}
                      >
                        <PlayCircle className="mr-1 h-4 w-4" />
                        Watch recording
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">
                        {cls.recordingStatus === "uploading" || cls.recordingStatus === "recording"
                          ? "Recording processing…"
                          : cls.recordingStatus === "failed"
                            ? "Recording unavailable"
                            : "No recording"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
