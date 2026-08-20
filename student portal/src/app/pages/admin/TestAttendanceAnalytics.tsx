import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
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
import { Alert, AlertDescription } from "../../components/ui/alert";
import { ArrowLeft, Download, Loader2, Users } from "lucide-react";
import { useData } from "../../context/DataContext";
import type { Student } from "../../context/DataContext";
import { listAllTestsWithAttemptsForAdmin, getExamTest } from "../../features/exams/examApi";
import type { ExamAttempt, ExamTest } from "../../features/exams/types";
import { calculateAttendanceStats, segmentByAttendance } from "../../features/exams/rankingUtils";
import { formatExamBatchLabel, getExamBatchIds } from "../../features/exams/examBatchUtils";
import {
  displayNameForAttempt,
  resolveAttemptParticipant,
} from "../../features/exams/adminTestReportUtils";
import * as XLSX from "xlsx";

interface AttendanceRow {
  studentId: string;
  studentName: string;
  email: string;
  status: "Attended" | "Not Attended" | "In Progress";
  score?: number;
  maxScore?: number;
  percentage?: number;
  submittedAt?: string;
}

export default function TestAttendanceAnalytics() {
  const navigate = useNavigate();
  const { students, batches } = useData();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<string>("all");
  const [selectedTest, setSelectedTest] = useState<string>("");
  const [allTests, setAllTests] = useState<
    Array<{ test: ExamTest; attempts: ExamAttempt[] }>
  >([]);
  const [currentTest, setCurrentTest] = useState<ExamTest | null>(null);
  const [currentAttempts, setCurrentAttempts] = useState<ExamAttempt[]>([]);

  // Load all tests on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await listAllTestsWithAttemptsForAdmin();
        if (!cancelled) {
          setAllTests(data);
          // Auto-select first test if available
          if (data.length > 0 && !selectedTest) {
            setSelectedTest(data[0].test.id);
          }
        }
      } catch (e) {
        console.error("Failed to load tests:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Update current test and attempts when selection changes
  useEffect(() => {
    if (selectedTest) {
      const testData = allTests.find((t) => t.test.id === selectedTest);
      if (testData) {
        setCurrentTest(testData.test);
        setCurrentAttempts(testData.attempts);
      }
    }
  }, [selectedTest, allTests]);

  // Get batch options
  const batchOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const test of allTests.map((t) => t.test)) {
      const batchIds = getExamBatchIds(test);
      for (const batchId of batchIds) {
        const batch = batches.find((b) => b.id === batchId);
        if (batch) {
          options.set(batchId, batch.name);
        }
      }
    }
    return Array.from(options.entries());
  }, [allTests, batches]);

  // Filter tests by selected batch
  const filteredTests = useMemo(() => {
    if (selectedBatch === "all") {
      return allTests.map((t) => t.test);
    }
    return allTests
      .map((t) => t.test)
      .filter((test) => {
        const batchIds = getExamBatchIds(test);
        return batchIds.includes(selectedBatch);
      });
  }, [allTests, selectedBatch]);

  // Get students enrolled for current test
  const enrolledStudentsForTest = useMemo(() => {
    if (!currentTest) return [];
    const batchIds = getExamBatchIds(currentTest);
    return students.filter((s) => batchIds.includes(s.batchId || ""));
  }, [currentTest, students]);

  // Build attendance table data
  const attendanceData = useMemo(() => {
    if (!currentTest)
      return {
        attended: [] as AttendanceRow[],
        notAttended: [] as AttendanceRow[],
      };

    // Create attempt lookup
    const attemptMap = new Map<string, ExamAttempt>();
    for (const attempt of currentAttempts) {
      const studentId = attempt.studentRecordId || attempt.uid;
      if (studentId) {
        attemptMap.set(studentId, attempt);
      }
    }

    // Create rows for each enrolled student
    const rows: AttendanceRow[] = enrolledStudentsForTest.map((student) => {
      const attempt = attemptMap.get(student.id);

      if (!attempt) {
        return {
          studentId: student.id,
          studentName: student.name || "Unknown",
          email: student.email || "",
          status: "Not Attended",
        };
      }

      const maxScore = attempt.maxScore ?? currentTest.totalMarks;
      const percentage =
        attempt.score != null && maxScore > 0
          ? Math.round((attempt.score / maxScore) * 1000) / 10
          : undefined;

      return {
        studentId: student.id,
        studentName: student.name || "Unknown",
        email: student.email || "",
        status: attempt.status === "submitted" ? "Attended" : "In Progress",
        score: attempt.score,
        maxScore,
        percentage,
        submittedAt: attempt.submittedAt
          ? new Date(attempt.submittedAt).toLocaleString()
          : undefined,
      };
    });

    // Segment into attended and not attended
    const attended = rows
      .filter((r) => r.status === "Attended")
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const notAttended = rows
      .filter((r) => r.status === "Not Attended" || r.status === "In Progress")
      .sort((a, b) => a.studentName.localeCompare(b.studentName));

    return { attended, notAttended };
  }, [currentTest, currentAttempts, enrolledStudentsForTest]);

  const stats = useMemo(() => {
    if (!currentTest) return null;
    return calculateAttendanceStats(
      enrolledStudentsForTest.length,
      currentAttempts,
    );
  }, [currentTest, currentAttempts, enrolledStudentsForTest]);

  const handleExportCsv = () => {
    if (!currentTest) return;

    setExporting(true);
    try {
      const allRows = [
        ...attendanceData.attended,
        ...attendanceData.notAttended,
      ];
      const exportData = allRows.map((row) => ({
        "Student ID": row.studentId,
        "Student Name": row.studentName,
        Email: row.email,
        Status: row.status,
        Score: row.score ?? "",
        "Max Score": row.maxScore ?? "",
        Percentage: row.percentage ? `${row.percentage}%` : "",
        "Submitted At": row.submittedAt || "",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attendance");

      const fileName = `${currentTest.title?.replace(/[\\/:*?"<>|]+/g, "_")}_attendance_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (e) {
      console.error("Export failed:", e);
      alert("Failed to export attendance data");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/admin/dashboard")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Test Attendance Analytics</h1>
            <p className="text-muted-foreground mt-1">
              Track student attendance and performance for specific tests
            </p>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Batch</label>
              <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a batch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Batches</SelectItem>
                  {batchOptions.map(([batchId, batchName]) => (
                    <SelectItem key={batchId} value={batchId}>
                      {batchName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Test</label>
              <Select value={selectedTest} onValueChange={setSelectedTest}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a test" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTests.map((test) => (
                    <SelectItem key={test.id} value={test.id}>
                      {test.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      {currentTest && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Enrolled
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEnrolled}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Attended
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.attended}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.attendancePercentage}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                In Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.inProgress}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Not Attempted
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.notAttempted}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Export Button */}
      {currentTest && (
        <div className="flex justify-end">
          <Button
            onClick={handleExportCsv}
            disabled={exporting}
            className="gap-2"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export as Excel
              </>
            )}
          </Button>
        </div>
      )}

      {/* Attendance Tables */}
      {currentTest ? (
        <div className="space-y-6">
          {/* Attended Students */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-600">
                  {attendanceData.attended.length}
                </Badge>
                Students Attended
              </CardTitle>
              <CardDescription>
                Students who completed and submitted the test
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted">
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead className="text-right">Percentage</TableHead>
                      <TableHead>Submitted At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceData.attended.length > 0 ? (
                      attendanceData.attended.map((row) => (
                        <TableRow key={row.studentId}>
                          <TableCell className="font-medium">
                            {row.studentName}
                          </TableCell>
                          <TableCell>{row.studentId}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.email}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.score !== undefined && row.maxScore
                              ? `${row.score}/${row.maxScore}`
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.percentage ? (
                              <Badge variant="outline" className="bg-green-50">
                                {row.percentage}%
                              </Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.submittedAt || "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground py-8"
                        >
                          No students have attended yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Not Attended Students */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="destructive">
                  {attendanceData.notAttended.length}
                </Badge>
                Students Not Attended
              </CardTitle>
              <CardDescription>
                Enrolled students who have not taken or submitted the test
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted">
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceData.notAttended.length > 0 ? (
                      attendanceData.notAttended.map((row) => (
                        <TableRow key={row.studentId}>
                          <TableCell className="font-medium">
                            {row.studentName}
                          </TableCell>
                          <TableCell>{row.studentId}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.email}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                row.status === "In Progress"
                                  ? "secondary"
                                  : "outline"
                              }
                              className={
                                row.status === "In Progress"
                                  ? "bg-blue-50"
                                  : "bg-red-50"
                              }
                            >
                              {row.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-muted-foreground py-8"
                        >
                          All enrolled students have attended
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Alert>
          <AlertDescription>
            Please select a test to view attendance analytics
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
