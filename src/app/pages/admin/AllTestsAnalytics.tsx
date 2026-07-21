import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Download, Loader2, ArrowLeft } from "lucide-react";
import { formatExamBatchLabel, getExamBatchIds } from "../../features/exams/examBatchUtils";
import { studentBelongsToBatch } from "../../features/students/studentBatchUtils";
import { listAllTestsWithAttemptsForAdmin } from "../../features/exams/examApi";
import type { ExamAttempt, ExamTest } from "../../features/exams/types";
import {
  attemptCompositeKey,
  buildAttemptsLookup,
  isEligibleForExam,
  percentScore,
  safeFileName,
  toIsoOrEmpty,
} from "../../features/exams/adminTestReportUtils";
import { useData } from "../../context/DataContext";
import type { Student } from "../../context/DataContext";
import * as XLSX from "xlsx";

function participationCellText(a: ExamAttempt | undefined, test: ExamTest) {
  if (!a) return "";
  const maxMarks = test.totalMarks;
  if (a.status === "submitted") {
    const pct = percentScore(a, maxMarks);
    const score = a.score ?? "";
    const max = a.maxScore ?? maxMarks;
    const pctPart = pct != null ? `${pct}%` : "";
    return `Submitted${pctPart ? ` · ${pctPart}` : ""}${score !== "" ? ` · ${score}/${max}` : ""}`;
  }
  return "In progress";
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}

type Row = {
  test: ExamTest;
  attempts: ExamAttempt[];
  batchName: string;
  started: number;
  submitted: number;
  inProgress: number;
  avgPercentSubmitted: number | null;
  minPercentSubmitted: number | null;
  maxPercentSubmitted: number | null;
};

type BatchAnalyticsRow = {
  batchId: string;
  batchName: string;
  studentCount: number;
  testsCount: number;
  eligibleSlots: number;
  started: number;
  submitted: number;
  inProgress: number;
  absent: number;
  attendanceRate: number | "";
  submissionRate: number | "";
  avgPercentSubmitted: number | "";
  minPercentSubmitted: number | "";
  maxPercentSubmitted: number | "";
};

type BatchTestAnalyticsRow = {
  batchId: string;
  batchName: string;
  test: ExamTest;
  eligibleStudents: number;
  started: number;
  submitted: number;
  inProgress: number;
  absent: number;
  attendanceRate: number | "";
  avgPercentSubmitted: number | "";
  minPercentSubmitted: number | "";
  maxPercentSubmitted: number | "";
  submittedPercentSum: number;
  submittedPercentCount: number;
};

export default function AllTestsAnalytics() {
  const navigate = useNavigate();
  const { students, batches } = useData();
  const [loading, setLoading] = useState(true);
  const [exportMode, setExportMode] = useState<null | "full" | "attendance" | "batch">(null);
  const [batchFilter, setBatchFilter] = useState("all");
  const [pairs, setPairs] = useState<{ test: ExamTest; attempts: ExamAttempt[] }[]>([]);
  const exporting = exportMode !== null;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await listAllTestsWithAttemptsForAdmin();
        if (!cancelled) setPairs(data);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows: Row[] = useMemo(() => {
    return pairs.map(({ test, attempts }) => {
      const batchName = formatExamBatchLabel(test, batches);
      const submittedAtt = attempts.filter((a) => a.status === "submitted");
      const inProgress = attempts.filter((a) => a.status === "in_progress").length;
      const percents = submittedAtt
        .map((a) => percentScore(a, test.totalMarks))
        .filter((p): p is number => p != null);
      const avgPercentSubmitted =
        percents.length > 0 ? Math.round((percents.reduce((s, p) => s + p, 0) / percents.length) * 10) / 10 : null;
      const minPercentSubmitted =
        percents.length > 0 ? Math.round(Math.min(...percents) * 10) / 10 : null;
      const maxPercentSubmitted =
        percents.length > 0 ? Math.round(Math.max(...percents) * 10) / 10 : null;
      return {
        test,
        attempts,
        batchName,
        started: attempts.length,
        submitted: submittedAtt.length,
        inProgress,
        avgPercentSubmitted,
        minPercentSubmitted,
        maxPercentSubmitted,
      };
    });
  }, [pairs, batches]);

  const totals = useMemo(() => {
    let started = 0;
    let submitted = 0;
    let inProgress = 0;
    for (const r of rows) {
      started += r.started;
      submitted += r.submitted;
      inProgress += r.inProgress;
    }
    return { tests: rows.length, started, submitted, inProgress };
  }, [rows]);

  const testsSorted = useMemo(
    () => [...rows].sort((a, b) => new Date(b.test.startAt).getTime() - new Date(a.test.startAt).getTime()),
    [rows],
  );

  const attemptsMap = useMemo(() => buildAttemptsLookup(pairs), [pairs]);

  const rosterSorted = useMemo(
    () => [...students].sort((a, b) => `${a.name}`.localeCompare(`${b.name}`, undefined, { sensitivity: "base" })),
    [students],
  );

  const batchTestAnalyticsRows: BatchTestAnalyticsRow[] = useMemo(() => {
    return batches.flatMap((batch) => {
      const batchStudents = students.filter((s) => studentBelongsToBatch(s, batch.id));
      return testsSorted
        .filter((r) => {
          const assignedToBatch = getExamBatchIds(r.test).includes(batch.id);
          const hasSelectiveStudent = batchStudents.some((s) => isEligibleForExam(s, r.test));
          return assignedToBatch || hasSelectiveStudent;
        })
        .map((r) => {
          const eligibleStudents = batchStudents.filter((s) => isEligibleForExam(s, r.test));
          const attempts = eligibleStudents
            .map((s) => attemptsMap.get(attemptCompositeKey(r.test.id, s.id)))
            .filter((a): a is ExamAttempt => Boolean(a));
          const submittedAttempts = attempts.filter((a) => a.status === "submitted");
          const percents = submittedAttempts
            .map((a) => percentScore(a, r.test.totalMarks))
            .filter((p): p is number => p != null);
          const started = attempts.length;
          const submitted = submittedAttempts.length;
          const inProgress = attempts.filter((a) => a.status === "in_progress").length;
          const attendanceRate =
            eligibleStudents.length > 0 ? roundPercent((started / eligibleStudents.length) * 100) : "";

          return {
            batchId: batch.id,
            batchName: batch.name,
            test: r.test,
            eligibleStudents: eligibleStudents.length,
            started,
            submitted,
            inProgress,
            absent: Math.max(eligibleStudents.length - started, 0),
            attendanceRate,
            avgPercentSubmitted:
              percents.length > 0 ? roundPercent(percents.reduce((sum, p) => sum + p, 0) / percents.length) : "",
            minPercentSubmitted: percents.length > 0 ? roundPercent(Math.min(...percents)) : "",
            maxPercentSubmitted: percents.length > 0 ? roundPercent(Math.max(...percents)) : "",
            submittedPercentSum: percents.reduce((sum, p) => sum + p, 0),
            submittedPercentCount: percents.length,
          };
        });
    });
  }, [attemptsMap, batches, students, testsSorted]);

  const batchAnalyticsRows: BatchAnalyticsRow[] = useMemo(() => {
    return batches.map((batch) => {
      const relatedRows = batchTestAnalyticsRows.filter((r) => r.batchId === batch.id);
      const submittedPercentCount = relatedRows.reduce((sum, r) => sum + r.submittedPercentCount, 0);
      const submittedPercentSum = relatedRows.reduce((sum, r) => sum + r.submittedPercentSum, 0);
      const minPercents = relatedRows
        .map((r) => r.minPercentSubmitted)
        .filter((p): p is number => typeof p === "number");
      const maxPercents = relatedRows
        .map((r) => r.maxPercentSubmitted)
        .filter((p): p is number => typeof p === "number");
      const eligibleSlots = relatedRows.reduce((sum, r) => sum + r.eligibleStudents, 0);
      const started = relatedRows.reduce((sum, r) => sum + r.started, 0);
      const submitted = relatedRows.reduce((sum, r) => sum + r.submitted, 0);
      const inProgress = relatedRows.reduce((sum, r) => sum + r.inProgress, 0);
      return {
        batchId: batch.id,
        batchName: batch.name,
        studentCount: students.filter((s) => studentBelongsToBatch(s, batch.id)).length,
        testsCount: relatedRows.length,
        eligibleSlots,
        started,
        submitted,
        inProgress,
        absent: Math.max(eligibleSlots - started, 0),
        attendanceRate: eligibleSlots > 0 ? roundPercent((started / eligibleSlots) * 100) : "",
        submissionRate: eligibleSlots > 0 ? roundPercent((submitted / eligibleSlots) * 100) : "",
        avgPercentSubmitted:
          submittedPercentCount > 0 ? roundPercent(submittedPercentSum / submittedPercentCount) : "",
        minPercentSubmitted: minPercents.length > 0 ? roundPercent(Math.min(...minPercents)) : "",
        maxPercentSubmitted: maxPercents.length > 0 ? roundPercent(Math.max(...maxPercents)) : "",
      };
    });
  }, [batchTestAnalyticsRows, batches, students]);

  const filteredBatchRows = useMemo(
    () => (batchFilter === "all" ? batchAnalyticsRows : batchAnalyticsRows.filter((r) => r.batchId === batchFilter)),
    [batchAnalyticsRows, batchFilter],
  );

  const filteredBatchTestRows = useMemo(
    () =>
      batchFilter === "all" ? batchTestAnalyticsRows : batchTestAnalyticsRows.filter((r) => r.batchId === batchFilter),
    [batchFilter, batchTestAnalyticsRows],
  );

  const studentLookup = (studentRecordId?: string) =>
    studentRecordId ? students.find((s) => s.id === studentRecordId) : undefined;

  const participantFromAttempt = (a: ExamAttempt) => {
    const enrolled = studentLookup(a.studentRecordId);
    if (a.isGuest || a.participantName || a.participantEmail) {
      return {
        name: a.participantName?.trim() || a.participantEmail?.trim() || "Guest",
        email: a.participantEmail?.trim() || "",
        studentId: "GUEST",
      };
    }
    return {
      name: enrolled?.name || "",
      email: enrolled?.email || "",
      studentId: enrolled?.studentId || "",
    };
  };

  /** Any started attempt counts as attended for this report (submitted or in progress). */
  function attendanceStatusForCell(student: Student, test: ExamTest): "ATTENDED" | "NA" {
    if (!isEligibleForExam(student, test)) return "NA";
    const a = attemptsMap.get(attemptCompositeKey(test.id, student.id));
    if (a && (a.status === "submitted" || a.status === "in_progress")) return "ATTENDED";
    return "NA";
  }

  const exportExcel = () => {
    setExportMode("full");
    try {
      const testSummary = rows.map((r) => ({
        examId: r.test.id,
        examTitle: r.test.title,
        subject: r.test.subject,
        batch: r.batchName,
        startAt: toIsoOrEmpty(r.test.startAt),
        endAt: toIsoOrEmpty(r.test.endAt),
        durationMinutes: r.test.durationMinutes,
        totalQuestions: r.test.totalQuestions,
        totalMarks: r.test.totalMarks,
        examStatus: (() => {
          const now = Date.now();
          const s = new Date(r.test.startAt).getTime();
          const e = new Date(r.test.endAt).getTime();
          if (now >= s && now <= e) return "active";
          if (now < s) return "upcoming";
          return "closed";
        })(),
        studentsStarted: r.started,
        studentsSubmitted: r.submitted,
        studentsInProgress: r.inProgress,
        avgPercent_amongSubmitted: r.avgPercentSubmitted ?? "",
        minPercent_amongSubmitted: r.minPercentSubmitted ?? "",
        maxPercent_amongSubmitted: r.maxPercentSubmitted ?? "",
      }));

      const allAttempts: Record<string, string | number>[] = [];
      for (const r of rows) {
        for (const a of r.attempts) {
          const p = participantFromAttempt(a);
          const pct = a.status === "submitted" ? percentScore(a, r.test.totalMarks) : null;
          allAttempts.push({
            examId: r.test.id,
            examTitle: r.test.title,
            subject: r.test.subject,
            batch: r.batchName,
            studentUid: a.uid,
            studentRecordId: a.studentRecordId || "",
            studentId: p.studentId,
            studentName: p.name,
            studentEmail: p.email,
            isGuest: a.isGuest ? "yes" : "no",
            attemptStatus: a.status,
            score: a.score ?? "",
            maxScore: a.maxScore ?? r.test.totalMarks,
            percent: pct ?? "",
            startedAt: toIsoOrEmpty(a.startedAt),
            submittedAt: toIsoOrEmpty(a.submittedAt),
            lastSavedAt: toIsoOrEmpty(a.lastSavedAt),
          });
        }
      }

      const rollupMap = new Map<
        string,
        {
          key: string;
          studentUid: string;
          studentRecordId: string;
          studentId: string;
          studentName: string;
          studentEmail: string;
          testsStarted: number;
          testsSubmitted: number;
          percents: number[];
        }
      >();

      for (const r of rows) {
        for (const a of r.attempts) {
          const p = participantFromAttempt(a);
          const st = studentLookup(a.studentRecordId);
          const rollupKey = a.studentRecordId || a.uid;
          let row = rollupMap.get(rollupKey);
          if (!row) {
            row = {
              key: rollupKey,
              studentUid: a.uid,
              studentRecordId: a.studentRecordId || "",
              studentId: p.studentId,
              studentName: p.name,
              studentEmail: p.email,
              testsStarted: 0,
              testsSubmitted: 0,
              percents: [],
            };
            rollupMap.set(rollupKey, row);
          }
          row.testsStarted += 1;
          if (a.status === "submitted") {
            row.testsSubmitted += 1;
            const p = percentScore(a, r.test.totalMarks);
            if (p != null) row.percents.push(p);
          }
          if (st?.studentId && !row.studentId) row.studentId = st.studentId;
          if (st?.name && !row.studentName) row.studentName = st.name;
          if (st?.email && !row.studentEmail) row.studentEmail = st.email;
        }
      }

      const studentOverview = Array.from(rollupMap.values()).map((u) => ({
        studentUid: u.studentUid,
        studentRecordId: u.studentRecordId,
        studentId: u.studentId,
        studentName: u.studentName,
        studentEmail: u.studentEmail,
        testsStarted: u.testsStarted,
        testsSubmitted: u.testsSubmitted,
        avgPercent_acrossSubmittedTests:
          u.percents.length > 0
            ? Math.round((u.percents.reduce((s, p) => s + p, 0) / u.percents.length) * 10) / 10
            : "",
      }));

      const matrixHeaders = [
        "studentRecordId",
        "studentId",
        "studentName",
        "studentEmail",
        "studentBatch",
        ...testsSorted.map((r) => {
          const t = r.test;
          const idShort = String(t.id).slice(0, 8);
          const titleCrop = String(t.title || "").slice(0, 55);
          return `[${idShort}] ${titleCrop}`;
        }),
      ];

      const matrixAoA: (string | number)[][] = [
        matrixHeaders,
        ...rosterSorted.map((s) => {
          const batchName = batches.find((b) => b.id === s.batchId)?.name || "";
          return [
            s.id,
            s.studentId,
            s.name,
            s.email,
            batchName,
            ...testsSorted.map((r) => {
              const a = attemptsMap.get(attemptCompositeKey(r.test.id, s.id));
              return participationCellText(a, r.test);
            }),
          ];
        }),
      ];

      const studentTestPairs = rosterSorted.flatMap((s) => {
        const batchName = batches.find((b) => b.id === s.batchId)?.name || "";
        return testsSorted.map((r) => {
          const t = r.test;
          const elig = isEligibleForExam(s, t);
          const a = attemptsMap.get(attemptCompositeKey(t.id, s.id));
          const pct = a?.status === "submitted" ? percentScore(a, t.totalMarks) : null;
          return {
            studentRecordId: s.id,
            studentId: s.studentId,
            studentName: s.name,
            studentEmail: s.email,
            studentBatch: batchName,
            examId: t.id,
            examTitle: t.title,
            examSubject: t.subject,
            examBatch: r.batchName,
            examStartAt: toIsoOrEmpty(t.startAt),
            examEndAt: toIsoOrEmpty(t.endAt),
            eligibleForExam: elig ? "Yes" : "No",
            attempted: a ? "Yes" : "No",
            attemptStatus: a?.status ?? "",
            score: a?.score ?? "",
            maxScore: a ? (a.maxScore ?? t.totalMarks) : "",
            percent: pct ?? "",
            startedAt: a ? toIsoOrEmpty(a.startedAt) : "",
            submittedAt: a ? toIsoOrEmpty(a.submittedAt) : "",
          };
        });
      });

      const everyStudentRollup = rosterSorted.map((s) => {
        const batchName = batches.find((b) => b.id === s.batchId)?.name || "";
        let examsEligible = 0;
        let examsAttempted = 0;
        let examsSubmitted = 0;
        for (const r of testsSorted) {
          if (!isEligibleForExam(s, r.test)) continue;
          examsEligible++;
          const a = attemptsMap.get(attemptCompositeKey(r.test.id, s.id));
          if (a) {
            examsAttempted++;
            if (a.status === "submitted") examsSubmitted++;
          }
        }
        const rate =
          examsEligible > 0 ? Math.round((examsAttempted / examsEligible) * 1000) / 10 : "";
        const submitRate =
          examsEligible > 0 ? Math.round((examsSubmitted / examsEligible) * 1000) / 10 : "";

        const fromAttempts = rollupMap.get(s.id);
        return {
          studentRecordId: s.id,
          studentId: s.studentId,
          studentName: s.name,
          studentEmail: s.email,
          studentBatch: batchName,
          studentStatus: s.status,
          examsEligible_visibilityRules: examsEligible,
          examsAttempted: examsAttempted,
          examsSubmitted: examsSubmitted,
          pctEligibleAttempted: rate,
          pctEligibleSubmitted: submitRate,
          testsStarted_anyExam: fromAttempts?.testsStarted ?? 0,
          testsSubmitted_anyExam: fromAttempts?.testsSubmitted ?? 0,
        };
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(testSummary), "Test summary");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(matrixAoA), "Participation_matrix");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentTestPairs), "Student_x_test_pairs");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(everyStudentRollup), "Every_student_summary");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allAttempts), "All attempts");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentOverview), "Students overview");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      XLSX.writeFile(wb, `${safeFileName(`all_tests_analytics_${stamp}`)}.xlsx`);
    } finally {
      setExportMode(null);
    }
  };

  /** Printable student × test grid: ATTENDED if the student started the test (eligible roster only); NA otherwise. */
  const exportAttendanceReportExcel = () => {
    if (testsSorted.length === 0) return;
    setExportMode("attendance");
    try {
      const numCols = 1 + testsSorted.length;
      const padRow = (): string[] => Array.from({ length: numCols }, () => "");

      const orgTitle = "Karthikeyan Analysis Study Circle & Learning Resources";
      const listTitle = "LIST OF STATISTICS CLASS TEST ATTENDANCE";
      const headerRow = ["CANDIDATES NAME", ...testsSorted.map((_, i) => `TEST.${i + 1}`)];

      const aoa: string[][] = [];
      {
        const r = padRow();
        r[0] = orgTitle;
        aoa.push(r);
      }
      {
        const r = padRow();
        r[0] = listTitle;
        aoa.push(r);
      }
      aoa.push(padRow());
      aoa.push(headerRow);

      for (const s of rosterSorted) {
        aoa.push([
          String(s.name || "").trim().toUpperCase(),
          ...testsSorted.map((row) => attendanceStatusForCell(s, row.test)),
        ]);
      }

      aoa.push(padRow());
      {
        const r = padRow();
        r[0] = "*NA - Not Attended";
        aoa.push(r);
      }

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const lastColIdx = numCols - 1;
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: lastColIdx } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: lastColIdx } },
      ];
      ws["!cols"] = [{ wch: 40 }, ...testsSorted.map(() => ({ wch: 14 }))];

      const keyAoA: (string | number)[][] = [
        ["Column", "Exam title", "Subject", "Batch", "Exam start (UTC)"],
        ...testsSorted.map((r, i) => [
          `TEST.${i + 1}`,
          r.test.title,
          r.test.subject,
          r.batchName,
          toIsoOrEmpty(r.test.startAt),
        ]),
      ];
      const wsKey = XLSX.utils.aoa_to_sheet(keyAoA);
      wsKey["!cols"] = [{ wch: 10 }, { wch: 48 }, { wch: 22 }, { wch: 22 }, { wch: 26 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Class_test_attendance");
      XLSX.utils.book_append_sheet(wb, wsKey, "TEST_column_key");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      XLSX.writeFile(wb, `${safeFileName(`class_test_attendance_${stamp}`)}.xlsx`);
    } finally {
      setExportMode(null);
    }
  };

  const exportBatchAnalyticsExcel = () => {
    if (batchAnalyticsRows.length === 0) return;
    setExportMode("batch");
    try {
      const scopedBatchIds =
        batchFilter === "all" ? batches.map((b) => b.id) : batches.filter((b) => b.id === batchFilter).map((b) => b.id);
      const scopedBatchIdSet = new Set(scopedBatchIds);
      const scopedBatchRows = batchAnalyticsRows.filter((r) => scopedBatchIdSet.has(r.batchId));
      const scopedBatchTestRows = batchTestAnalyticsRows.filter((r) => scopedBatchIdSet.has(r.batchId));
      const scopedStudents = rosterSorted.filter((s) => s.batchId && scopedBatchIdSet.has(s.batchId));

      const batchSummary = scopedBatchRows.map((r) => ({
        batchId: r.batchId,
        batchName: r.batchName,
        enrolledStudents: r.studentCount,
        testsInScope: r.testsCount,
        eligibleStudentTestSlots: r.eligibleSlots,
        started: r.started,
        submitted: r.submitted,
        inProgress: r.inProgress,
        absent: r.absent,
        attendanceRate_pct: r.attendanceRate,
        submissionRate_pct: r.submissionRate,
        avgPercent_amongSubmitted: r.avgPercentSubmitted,
        minPercent_amongSubmitted: r.minPercentSubmitted,
        maxPercent_amongSubmitted: r.maxPercentSubmitted,
      }));

      const batchTestSummary = scopedBatchTestRows.map((r) => ({
        batchId: r.batchId,
        batchName: r.batchName,
        examId: r.test.id,
        examTitle: r.test.title,
        subject: r.test.subject,
        startAt: toIsoOrEmpty(r.test.startAt),
        endAt: toIsoOrEmpty(r.test.endAt),
        durationMinutes: r.test.durationMinutes,
        totalQuestions: r.test.totalQuestions,
        totalMarks: r.test.totalMarks,
        eligibleStudents: r.eligibleStudents,
        started: r.started,
        submitted: r.submitted,
        inProgress: r.inProgress,
        absent: r.absent,
        attendanceRate_pct: r.attendanceRate,
        avgPercent_amongSubmitted: r.avgPercentSubmitted,
        minPercent_amongSubmitted: r.minPercentSubmitted,
        maxPercent_amongSubmitted: r.maxPercentSubmitted,
      }));

      const studentSummary = scopedStudents.map((s) => {
        const batchName = batches.find((b) => b.id === s.batchId)?.name || "";
        let eligible = 0;
        let started = 0;
        let submitted = 0;
        let inProgress = 0;
        const percents: number[] = [];
        for (const r of testsSorted) {
          if (!isEligibleForExam(s, r.test)) continue;
          eligible++;
          const a = attemptsMap.get(attemptCompositeKey(r.test.id, s.id));
          if (!a) continue;
          started++;
          if (a.status === "in_progress") inProgress++;
          if (a.status === "submitted") {
            submitted++;
            const pct = percentScore(a, r.test.totalMarks);
            if (pct != null) percents.push(pct);
          }
        }
        return {
          studentRecordId: s.id,
          studentId: s.studentId,
          studentName: s.name,
          studentEmail: s.email,
          batchId: s.batchId || "",
          batchName,
          rosterStatus: s.status,
          examsEligible: eligible,
          examsStarted_present: started,
          examsSubmitted: submitted,
          examsInProgress: inProgress,
          examsAbsent_eligibleNoStart: Math.max(eligible - started, 0),
          attendanceRate_pct: eligible > 0 ? roundPercent((started / eligible) * 100) : "",
          submissionRate_pct: eligible > 0 ? roundPercent((submitted / eligible) * 100) : "",
          avgPercent_amongSubmittedTests:
            percents.length > 0 ? roundPercent(percents.reduce((sum, p) => sum + p, 0) / percents.length) : "",
          minPercent_amongSubmittedTests: percents.length > 0 ? roundPercent(Math.min(...percents)) : "",
          maxPercent_amongSubmittedTests: percents.length > 0 ? roundPercent(Math.max(...percents)) : "",
        };
      });

      const studentTestDetail = scopedStudents.flatMap((s) => {
        const batchName = batches.find((b) => b.id === s.batchId)?.name || "";
        return testsSorted
          .filter((r) => isEligibleForExam(s, r.test))
          .map((r) => {
            const a = attemptsMap.get(attemptCompositeKey(r.test.id, s.id));
            const pct = a?.status === "submitted" ? percentScore(a, r.test.totalMarks) : null;
            return {
              studentRecordId: s.id,
              studentId: s.studentId,
              studentName: s.name,
              studentEmail: s.email,
              batchId: s.batchId || "",
              batchName,
              examId: r.test.id,
              examTitle: r.test.title,
              examSubject: r.test.subject,
              examStartAt: toIsoOrEmpty(r.test.startAt),
              examEndAt: toIsoOrEmpty(r.test.endAt),
              presentAbsent: a ? "Present" : "Absent",
              attemptStatus: a?.status ?? "",
              score: a?.score ?? "",
              maxMarks: a ? (a.maxScore ?? r.test.totalMarks) : "",
              percent: pct ?? "",
              startedAt: a ? toIsoOrEmpty(a.startedAt) : "",
              submittedAt: a ? toIsoOrEmpty(a.submittedAt) : "",
              lastSavedAt: a ? toIsoOrEmpty(a.lastSavedAt) : "",
            };
          });
      });

      const notesAoA: string[][] = [
        ["Batch-wise analytics export"],
        [""],
        ["Eligible student-test slot", "One enrolled student who can access one exam."],
        ["Present/started", "Student has an attempt record for that exam, submitted or in progress."],
        ["Absent", "Student was eligible for the exam but has no attempt record."],
        ["N/A", "Guest/passcode-only attempts are not included in batch roster analytics."],
        [""],
        [`Batch filter: ${batchFilter === "all" ? "All batches" : scopedBatchRows[0]?.batchName || batchFilter}`],
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(batchSummary), "Batch_summary");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(batchTestSummary), "Batch_test_summary");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentSummary), "Batch_student_summary");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentTestDetail), "Student_test_detail");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(notesAoA), "Notes");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const fileScope = batchFilter === "all" ? "all_batches" : scopedBatchRows[0]?.batchName || batchFilter;
      XLSX.writeFile(wb, `${safeFileName(`batch_wise_analytics_${fileScope}_${stamp}`)}.xlsx`);
    } finally {
      setExportMode(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="w-fit -ml-2" onClick={() => navigate("/admin/tests")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to tests
          </Button>
          <h1 className="text-2xl font-semibold text-slate-900">All tests — performance analytics</h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Attendance and scores across every CBT test. Use{" "}
            <span className="font-medium text-slate-800">Attendance report</span> for a student-by-test grid (ATTENDED /
            NA). The full Excel workbook includes a detailed participation matrix, student×test pairs, raw attempts, and
            summaries.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            variant="outline"
            className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
            onClick={exportBatchAnalyticsExcel}
            disabled={loading || exporting || filteredBatchRows.length === 0}
          >
            {exportMode === "batch" ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Batch-wise Excel
          </Button>
          <Button
            variant="outline"
            className="border-slate-300"
            onClick={exportAttendanceReportExcel}
            disabled={loading || exporting || rows.length === 0}
          >
            {exportMode === "attendance" ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Attendance report
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={exportExcel}
            disabled={loading || exporting || rows.length === 0}
          >
            {exportMode === "full" ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Full analytics Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tests</CardDescription>
            <CardTitle className="text-2xl">{totals.tests}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total attempts (started)</CardDescription>
            <CardTitle className="text-2xl">{totals.started}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Submitted</CardDescription>
            <CardTitle className="text-2xl text-emerald-800">{totals.submitted}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>In progress</CardDescription>
            <CardTitle className="text-2xl text-amber-800">{totals.inProgress}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Batch-wise analytics</CardTitle>
            <CardDescription>
              Batch-level attendance, submission, and score trends across all eligible CBT tests.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={batchFilter} onValueChange={setBatchFilter}>
              <SelectTrigger className="w-full sm:w-[220px]" aria-label="Filter batch analytics">
                <SelectValue placeholder="Filter by batch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All batches</SelectItem>
                {batches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={exportBatchAnalyticsExcel}
              disabled={loading || exporting || filteredBatchRows.length === 0}
            >
              {exportMode === "batch" ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Export Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-600 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading batch analytics…
            </div>
          ) : filteredBatchRows.length === 0 ? (
            <p className="text-sm text-slate-500">No batch analytics found.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch</TableHead>
                      <TableHead className="text-right">Students</TableHead>
                      <TableHead className="text-right">Tests</TableHead>
                      <TableHead className="text-right">Eligible slots</TableHead>
                      <TableHead className="text-right">Started</TableHead>
                      <TableHead className="text-right">Submitted</TableHead>
                      <TableHead className="text-right">Absent</TableHead>
                      <TableHead className="text-right">Attendance</TableHead>
                      <TableHead className="text-right">Avg %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBatchRows.map((r) => (
                      <TableRow key={r.batchId}>
                        <TableCell className="font-medium text-slate-900">{r.batchName}</TableCell>
                        <TableCell className="text-right">{r.studentCount}</TableCell>
                        <TableCell className="text-right">{r.testsCount}</TableCell>
                        <TableCell className="text-right">{r.eligibleSlots}</TableCell>
                        <TableCell className="text-right">{r.started}</TableCell>
                        <TableCell className="text-right">{r.submitted}</TableCell>
                        <TableCell className="text-right">{r.absent}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.attendanceRate !== "" ? `${r.attendanceRate}%` : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.avgPercentSubmitted !== "" ? `${r.avgPercentSubmitted}%` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {batchFilter !== "all" && (
                <div className="overflow-x-auto border-t border-slate-100 pt-5">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-slate-900">Selected batch test breakdown</h3>
                    <p className="text-xs text-slate-500">Each row is one test for the selected batch.</p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Test</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead className="text-right">Eligible</TableHead>
                        <TableHead className="text-right">Started</TableHead>
                        <TableHead className="text-right">Submitted</TableHead>
                        <TableHead className="text-right">Absent</TableHead>
                        <TableHead className="text-right">Avg %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBatchTestRows.map((r) => (
                        <TableRow key={`${r.batchId}-${r.test.id}`}>
                          <TableCell className="font-medium text-slate-900 max-w-[240px] truncate" title={r.test.title}>
                            {r.test.title}
                          </TableCell>
                          <TableCell className="text-sm">{r.test.subject}</TableCell>
                          <TableCell className="text-right">{r.eligibleStudents}</TableCell>
                          <TableCell className="text-right">{r.started}</TableCell>
                          <TableCell className="text-right">{r.submitted}</TableCell>
                          <TableCell className="text-right">{r.absent}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.avgPercentSubmitted !== "" ? `${r.avgPercentSubmitted}%` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-test summary</CardTitle>
          <CardDescription>
            Students started includes in-progress and submitted. Percent metrics use submitted attempts only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-600 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading analytics…
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">No tests found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-right">Started</TableHead>
                    <TableHead className="text-right">Submitted</TableHead>
                    <TableHead className="text-right">In progress</TableHead>
                    <TableHead className="text-right">Avg %</TableHead>
                    <TableHead className="text-right">Min %</TableHead>
                    <TableHead className="text-right">Max %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.test.id}>
                      <TableCell className="font-medium text-slate-900 max-w-[200px] truncate" title={r.test.title}>
                        {r.test.title}
                      </TableCell>
                      <TableCell className="text-sm">{r.batchName}</TableCell>
                      <TableCell className="text-sm">{r.test.subject}</TableCell>
                      <TableCell className="text-right">{r.started}</TableCell>
                      <TableCell className="text-right">{r.submitted}</TableCell>
                      <TableCell className="text-right">{r.inProgress}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.avgPercentSubmitted != null ? `${r.avgPercentSubmitted}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.minPercentSubmitted != null ? `${r.minPercentSubmitted}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.maxPercentSubmitted != null ? `${r.maxPercentSubmitted}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Badge variant="outline" className="text-xs font-normal max-w-full justify-center text-center h-auto py-2 leading-relaxed">
          Full workbook sheets: summary, participation matrix, student×test pairs, every-student rollup, raw attempts,
          overview. Batch-wise Excel sheets: batch summary, batch×test summary, batch student summary, detail rows.
          Attendance report file: printable grid + TEST_column_key (which TEST.n is which exam).
        </Badge>
      </div>
    </div>
  );
}
