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
import {
  BarChart3,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Edit2,
  FileSpreadsheet,
  Folder,
  FolderOpen,
  LayoutList,
  MoveRight,
  Radio,
  Rows3,
  Square,
  Trash2,
} from "lucide-react";
import { CopyGuestLinkButton } from "../../components/exams/CopyGuestLinkButton";
import { ExamCloseToggleButton } from "../../components/exams/ExamCloseToggleButton";
import { ExamLateAccessButton } from "../../components/exams/ExamLateAccessButton";
import { formatExamBatchLabel, getExamBatchIds, normalizeExamBatchFields } from "../../features/exams/examBatchUtils";
import { deleteExamTest, listExamTestsForAdmin, updateExamTest } from "../../features/exams/examApi";
import {
  examWindowStatusLabel,
  getExamWindowStatus,
  isExamManuallyClosed,
} from "../../features/exams/examAvailability";
import type { ExamTest } from "../../features/exams/types";

type TestSortKey = "newest" | "oldest" | "title" | "batch" | "subject" | "window" | "status" | "publish";
type ViewMode = "list" | "grouped";

export default function ExamManagement() {
  const { batches } = useData();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<ExamTest[]>([]);
  const [sortKey, setSortKey] = useState<TestSortKey>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("grouped");
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  // Selection + bulk assign state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBatchId, setBulkBatchId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

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
    return () => { cancelled = true; };
  }, []);

  // Auto-expand all batch folders on first grouped view
  useEffect(() => {
    if (viewMode === "grouped") {
      const ids = new Set(batches.map((b) => b.id));
      ids.add("__ungrouped__");
      setExpandedBatches(ids);
    }
  }, [viewMode, batches]);

  const toggleBatch = (id: string) => {
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const patchTest = (updated: ExamTest) => {
    setTests((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const remove = async (testId: string) => {
    if (!confirm("Delete this exam? (Subcollections need Firebase CLI recursive delete)")) return;
    try {
      await deleteExamTest(testId);
      setTests((prev) => prev.filter((t) => t.id !== testId));
      setSelectedIds((prev) => { const s = new Set(prev); s.delete(testId); return s; });
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
    if (isExamManuallyClosed(t)) return <Badge className="bg-slate-200 text-slate-800">{label}</Badge>;
    if (windowStatus === "active") return <Badge className="bg-green-100 text-green-800">{label}</Badge>;
    if (windowStatus === "upcoming") return <Badge className="bg-blue-100 text-blue-800">{label}</Badge>;
    return <Badge className="bg-gray-100 text-gray-800">{label}</Badge>;
  };

  // ── Selection helpers ─────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleSelectAll = (ids: string[]) => {
    const allSelected = ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (allSelected) ids.forEach((id) => s.delete(id));
      else ids.forEach((id) => s.add(id));
      return s;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ── Bulk batch assignment ─────────────────────────────────────────────────
  const handleBulkAssign = async () => {
    if (!bulkBatchId || selectedIds.size === 0) return;
    setAssigning(true);
    try {
      const fields = normalizeExamBatchFields([bulkBatchId]);
      await Promise.all(
        [...selectedIds].map((id) => updateExamTest(id, fields)),
      );
      const batchName = batches.find((b) => b.id === bulkBatchId)?.name || "";
      setTests((prev) =>
        prev.map((t) =>
          selectedIds.has(t.id)
            ? { ...t, batchId: bulkBatchId, batchIds: [bulkBatchId], subject: t.subject }
            : t,
        ),
      );
      clearSelection();
      setBulkBatchId("");
      alert(`${selectedIds.size} test(s) moved to "${batchName}".`);
    } catch (e) {
      console.error(e);
      alert("Failed to assign batch. Please try again.");
    } finally {
      setAssigning(false);
    }
  };

  // ── Exam row (reused in both views) ──────────────────────────────────────
  const examRow = (t: ExamTest, showBatchCol = true) => {
    const isSelected = selectedIds.has(t.id);
    return (
      <TableRow key={t.id} className={`hover:bg-slate-50 ${isSelected ? "bg-indigo-50" : ""}`}>
        <TableCell className="w-10 pl-4 pr-1">
          <button
            type="button"
            onClick={() => toggleSelect(t.id)}
            className="text-slate-400 hover:text-indigo-600 transition"
            aria-label="Select"
          >
            {isSelected
              ? <CheckSquare className="w-4 h-4 text-indigo-600" />
              : <Square className="w-4 h-4" />}
          </button>
        </TableCell>
        <TableCell className="font-medium text-slate-900">{t.title}</TableCell>
        {showBatchCol && (
          <TableCell className="text-sm">{formatExamBatchLabel(t, batches)}</TableCell>
        )}
        <TableCell className="text-sm">{t.subject}</TableCell>
        <TableCell className="text-xs text-slate-600 min-w-[200px] whitespace-nowrap">
          {new Date(t.startAt).toLocaleString()} – {new Date(t.endAt).toLocaleString()}
        </TableCell>
        <TableCell>{statusBadge(t)}</TableCell>
        <TableCell>
          {t.status === "published"
            ? <Badge className="bg-emerald-100 text-emerald-800">Published</Badge>
            : <Badge variant="outline">Draft</Badge>}
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
              variant="ghost" size="sm" className="text-indigo-700 hover:bg-indigo-50"
              onClick={() => navigate(`/admin/tests/${t.id}/dashboard`)}
              aria-label="Edit test"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost" size="sm" className="text-emerald-700 hover:bg-emerald-50"
              onClick={() => navigate(`/admin/tests/${t.id}/results`)}
              aria-label="View results"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost" size="sm" className="text-rose-700 hover:bg-rose-50"
              onClick={() => void remove(t.id)}
              aria-label="Delete test"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  // ── Batch folder (grouped view) ───────────────────────────────────────────
  const batchFolder = (batchId: string, batchName: string, batchTests: ExamTest[]) => {
    const isOpen = expandedBatches.has(batchId);
    const allSelected = batchTests.length > 0 && batchTests.every((t) => selectedIds.has(t.id));
    return (
      <Card key={batchId} className="overflow-hidden">
        <div
          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition cursor-pointer select-none"
          onClick={() => toggleBatch(batchId)}
        >
          <span className="text-indigo-500">
            {isOpen ? <FolderOpen className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
          </span>
          <span className="flex-1 font-semibold text-slate-800">{batchName}</span>
          <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2.5 py-1 rounded-full">
            {batchTests.length} test{batchTests.length !== 1 ? "s" : ""}
          </span>
          <span className="text-slate-400 ml-1">
            {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </span>
        </div>
        {isOpen && (
          <div className="border-t border-slate-100">
            {batchTests.length === 0 ? (
              <p className="text-sm text-slate-400 px-6 py-4">No tests in this batch yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-10 pl-4 pr-1">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleSelectAll(batchTests.map((t) => t.id)); }}
                          className="text-slate-400 hover:text-indigo-600 transition"
                          aria-label="Select all in batch"
                        >
                          {allSelected
                            ? <CheckSquare className="w-4 h-4 text-indigo-600" />
                            : <Square className="w-4 h-4" />}
                        </button>
                      </TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead className="min-w-[200px]">Window</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Publish</TableHead>
                      <TableHead>Questions</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batchTests.map((t) => examRow(t, false))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </Card>
    );
  };

  const allSortedIds = sortedTests.map((t) => t.id);
  const allSelected = allSortedIds.length > 0 && allSortedIds.every((id) => selectedIds.has(id));

  return (
    <div className="space-y-6">
      {/* Header */}
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
        {/* View toggle */}
        <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
          <button
            type="button"
            onClick={() => setViewMode("grouped")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
              viewMode === "grouped" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Rows3 className="w-4 h-4" />
            By Batch
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
              viewMode === "list" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <LayoutList className="w-4 h-4" />
            All tests
          </button>
        </div>
      </div>

      {/* Bulk assign bar — appears when tests are selected */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-indigo-700 text-white px-5 py-3 rounded-xl shadow">
          <span className="font-semibold text-sm">
            {selectedIds.size} test{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <Select value={bulkBatchId} onValueChange={setBulkBatchId}>
            <SelectTrigger className="w-[220px] bg-white text-slate-900 border-0 h-8 text-sm">
              <SelectValue placeholder="Select batch to assign…" />
            </SelectTrigger>
            <SelectContent>
              {batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="bg-white text-indigo-700 hover:bg-indigo-50 h-8 gap-1.5"
            disabled={!bulkBatchId || assigning}
            onClick={handleBulkAssign}
          >
            <MoveRight className="w-4 h-4" />
            {assigning ? "Assigning…" : "Assign to Batch"}
          </Button>
          <button
            type="button"
            onClick={clearSelection}
            className="text-white/70 hover:text-white text-sm underline"
          >
            Clear
          </button>
        </div>
      )}

      <Alert className="border-indigo-200 bg-indigo-50">
        <Calendar className="h-4 w-4 text-indigo-600" />
        <AlertTitle className="text-indigo-900">Test control</AlertTitle>
        <AlertDescription className="text-indigo-800">
          Use the lock icon to end a test for new attempts. Students already taking the exam can
          finish; results and exports remain available. Reopen anytime with the unlock icon.
        </AlertDescription>
      </Alert>

      {loading ? (
        <Card><CardContent className="pt-6 text-sm text-slate-500">Loading exams...</CardContent></Card>
      ) : tests.length === 0 ? (
        <Card><CardContent className="pt-6 text-sm text-slate-500">No exams yet.</CardContent></Card>
      ) : viewMode === "grouped" ? (
        /* ── Grouped by batch ── */
        <div className="space-y-3">
          {batches.map((batch) => {
            const batchTests = sortedTests.filter((t) => getExamBatchIds(t).includes(batch.id));
            return batchFolder(batch.id, batch.name, batchTests);
          })}
          {(() => {
            const ungrouped = sortedTests.filter((t) => getExamBatchIds(t).length === 0);
            if (!ungrouped.length) return null;
            return batchFolder("__ungrouped__", "Ungrouped (no batch assigned)", ungrouped);
          })()}
        </div>
      ) : (
        /* ── Flat list ── */
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 pl-4 pr-1">
                      <button
                        type="button"
                        onClick={() => toggleSelectAll(allSortedIds)}
                        className="text-slate-400 hover:text-indigo-600 transition"
                        aria-label="Select all"
                      >
                        {allSelected
                          ? <CheckSquare className="w-4 h-4 text-indigo-600" />
                          : <Square className="w-4 h-4" />}
                      </button>
                    </TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="min-w-[200px]">Window</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Publish</TableHead>
                    <TableHead>Questions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTests.map((t) => examRow(t, true))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
