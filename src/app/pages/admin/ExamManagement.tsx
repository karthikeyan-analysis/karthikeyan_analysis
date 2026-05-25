import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useData } from "../../context/DataContext";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { BarChart3, Calendar, Edit2, FileSpreadsheet, Radio, Trash2 } from "lucide-react";
import { CopyGuestLinkButton } from "../../components/exams/CopyGuestLinkButton";
import { ExamCloseToggleButton } from "../../components/exams/ExamCloseToggleButton";
import { ExamLateAccessButton } from "../../components/exams/ExamLateAccessButton";
import { formatExamBatchLabel } from "../../features/exams/examBatchUtils";
import { deleteExamTest, listExamTestsForAdmin } from "../../features/exams/examApi";
import {
  examWindowStatusLabel,
  getExamWindowStatus,
  isExamManuallyClosed,
} from "../../features/exams/examAvailability";
import type { ExamTest } from "../../features/exams/types";

type TestSortKey = "newest" | "oldest" | "title" | "batch" | "subject" | "window" | "status" | "publish";

export default function ExamManagement() {
  const { batches } = useData();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<ExamTest[]>([]);
  const [sortKey, setSortKey] = useState<TestSortKey>("newest");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const t = await listExamTestsForAdmin();
        if (!cancelled) setTests(t);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const patchTest = (updated: ExamTest) => {
    setTests((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const remove = async (testId: string) => {
    if (!confirm("Delete this exam? (Subcollections need Firebase CLI recursive delete)")) return;
    try {
      await deleteExamTest(testId);
      setTests((prev) => prev.filter((t) => t.id !== testId));
    } catch (e) {
      console.error(e);
      alert("Delete failed.");
    }
  };

  const sortedTests = useMemo(() => {
    const text = (value?: string) => String(value || "").toLowerCase();
    const timestamp = (value?: string) => {
      const ms = value ? new Date(value).getTime() : 0;
      return Number.isFinite(ms) ? ms : 0;
    };

    return [...tests].sort((a, b) => {
      if (sortKey === "newest") return timestamp(b.createdAt || b.startAt) - timestamp(a.createdAt || a.startAt);
      if (sortKey === "oldest") return timestamp(a.createdAt || a.startAt) - timestamp(b.createdAt || b.startAt);
      if (sortKey === "title") return text(a.title).localeCompare(text(b.title));
      if (sortKey === "batch") return text(formatExamBatchLabel(a, batches)).localeCompare(text(formatExamBatchLabel(b, batches)));
      if (sortKey === "subject") return text(a.subject).localeCompare(text(b.subject));
      if (sortKey === "window") return timestamp(a.startAt) - timestamp(b.startAt);
      if (sortKey === "status") return getExamWindowStatus(a).localeCompare(getExamWindowStatus(b));
      return text(a.status || "draft").localeCompare(text(b.status || "draft"));
    });
  }, [batches, sortKey, tests]);

  const statusBadge = (t: ExamTest) => {
    const windowStatus = getExamWindowStatus(t);
    const label = examWindowStatusLabel(t);

    if (isExamManuallyClosed(t)) {
      return <Badge className="bg-slate-200 text-slate-800">{label}</Badge>;
    }
    if (windowStatus === "active") {
      return <Badge className="bg-green-100 text-green-800">{label}</Badge>;
    }
    if (windowStatus === "upcoming") {
      return <Badge className="bg-blue-100 text-blue-800">{label}</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-800">{label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => navigate("/admin/tests/new")}>
            Create a New Test
          </Button>
          <Button variant="outline" onClick={() => navigate("/admin/tests/live-monitor")}>
            <Radio className="w-4 h-4 mr-2" />
            Live monitor
          </Button>
          <Button variant="outline" onClick={() => navigate("/admin/tests/analytics")}>
            <BarChart3 className="w-4 h-4 mr-2" />
            All tests analytics
          </Button>
        </div>
      </div>

      <Alert className="border-indigo-200 bg-indigo-50">
        <Calendar className="h-4 w-4 text-indigo-600" />
        <AlertTitle className="text-indigo-900">Test control</AlertTitle>
        <AlertDescription className="text-indigo-800">
          Use the lock icon to end a test for new attempts. Students already taking the exam can
          finish; results and exports remain available. Reopen anytime with the unlock icon.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>All CBT exams</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Arrange by</span>
            <Select value={sortKey} onValueChange={(value) => setSortKey(value as TestSortKey)}>
              <SelectTrigger className="w-[210px]" aria-label="Arrange tests">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest created first</SelectItem>
                <SelectItem value="oldest">Oldest created first</SelectItem>
                <SelectItem value="window">Exam date/time</SelectItem>
                <SelectItem value="title">Title A-Z</SelectItem>
                <SelectItem value="batch">Batch A-Z</SelectItem>
                <SelectItem value="subject">Subject A-Z</SelectItem>
                <SelectItem value="status">Window status</SelectItem>
                <SelectItem value="publish">Publish status</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-slate-500">Loading exams...</div>
          ) : tests.length === 0 ? (
            <div className="text-sm text-slate-500">No exams yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Window</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Publish</TableHead>
                    <TableHead>Questions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTests.map((t) => {
                    const batchName = formatExamBatchLabel(t, batches);
                    return (
                      <TableRow key={t.id} className="hover:bg-slate-50">
                        <TableCell className="font-medium text-slate-900">{t.title}</TableCell>
                        <TableCell className="text-sm">{batchName}</TableCell>
                        <TableCell className="text-sm">{t.subject}</TableCell>
                        <TableCell className="text-xs text-slate-600 max-w-[200px]">
                          {new Date(t.startAt).toLocaleString()} – {new Date(t.endAt).toLocaleString()}
                        </TableCell>
                        <TableCell>{statusBadge(t)}</TableCell>
                        <TableCell>
                          {t.status === "published" ? (
                            <Badge className="bg-emerald-100 text-emerald-800">Published</Badge>
                          ) : (
                            <Badge variant="outline">Draft</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="font-semibold">{t.totalQuestions}</span> /{" "}
                          <span className="font-semibold">{t.totalMarks}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-1">
                            <ExamCloseToggleButton test={t} onUpdated={patchTest} />
                            <ExamLateAccessButton test={t} onUpdated={patchTest} />
                            <CopyGuestLinkButton test={t} />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-indigo-700 hover:bg-indigo-50"
                              onClick={() => navigate(`/admin/tests/${t.id}/dashboard`)}
                              aria-label="Edit test"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-emerald-700 hover:bg-emerald-50"
                              onClick={() => navigate(`/admin/tests/${t.id}/results`)}
                              aria-label="View results"
                            >
                              <FileSpreadsheet className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-rose-700 hover:bg-rose-50"
                              onClick={() => void remove(t.id)}
                              aria-label="Delete test"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
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
    </div>
  );
}
