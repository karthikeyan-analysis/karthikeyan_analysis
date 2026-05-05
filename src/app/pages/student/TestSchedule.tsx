import React from "react";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Calendar, CheckCircle2, FileCheck2, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listExamTestsForStudent } from "../../features/exams/examApi";
import type { ExamTest } from "../../features/exams/types";
import { useNavigate } from "react-router";

export default function TestSchedule() {
  const { user } = useAuth();
  const { batches, getTestsByBatch } = useData();
  const navigate = useNavigate();

  const currentBatch = batches.find((b) => b.id === user?.batchId);
  const batchTests = user?.batchId ? getTestsByBatch(user.batchId) : [];

  const [examTests, setExamTests] = useState<ExamTest[]>([]);
  const [examLoading, setExamLoading] = useState(false);

  useEffect(() => {
    if (!user?.batchId) return;
    let cancelled = false;
    const load = async () => {
      setExamLoading(true);
      try {
        const t = await listExamTestsForStudent({
          batchId: user.batchId!,
          studentRecordId: user.studentRecordId,
        });
        if (!cancelled) setExamTests(t);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setExamLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.batchId, user?.studentRecordId]);

  if (!user?.batchId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold text-slate-900">Test Schedule</h1>
        <Alert>
          <AlertTitle>Not Enrolled</AlertTitle>
          <AlertDescription>
            You are not enrolled in any batch. Please contact administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const activeTests = batchTests.filter((t) => t.status === "active");
  const closedTests = batchTests.filter((t) => t.status === "closed");
  const upcomingTests = batchTests.filter((t) => t.status === "upcoming");

  const now = Date.now();
  const studentExams = useMemo(() => {
    const items = [...examTests].sort(
      (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
    );
    const active = items.filter(
      (t) => now >= new Date(t.startAt).getTime() && now <= new Date(t.endAt).getTime(),
    );
    const upcoming = items.filter((t) => now < new Date(t.startAt).getTime());
    const closed = items.filter((t) => now > new Date(t.endAt).getTime());
    return { active, upcoming, closed, all: items };
  }, [examTests, now]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">START NOW</Badge>;
      case "closed":
        return <Badge className="bg-gray-100 text-gray-800">Closed</Badge>;
      case "upcoming":
        return <Badge className="bg-blue-100 text-blue-800">Upcoming</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const TestTableSection = ({
    title,
    tests,
    icon: Icon,
    isExam = false,
  }: {
    title: string;
    tests: any[];
    icon: any;
    isExam?: boolean;
  }) => {
    if (tests.length === 0) return null;

    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Icon className="w-5 h-5" />
          {title}
        </h2>
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Test Portion</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tests.map((test) => (
                    <TableRow key={test.id} className="hover:bg-slate-50">
                      <TableCell className="font-semibold text-indigo-600">
                        {isExam ? test.title : test.testNo}
                      </TableCell>
                      <TableCell className="text-sm">
                        {isExam ? new Date(test.startAt).toLocaleDateString() : test.testDate}
                      </TableCell>
                      <TableCell className="text-sm">
                        {isExam ? test.subject : test.portion}
                      </TableCell>
                      <TableCell className="text-sm">
                        {isExam
                          ? `${new Date(test.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${new Date(test.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                          : `${test.startTime} – ${test.endTime}`}
                      </TableCell>
                      <TableCell>
                        {isExam ? (
                          now >= new Date(test.startAt).getTime() &&
                          now <= new Date(test.endAt).getTime() ? (
                            <Badge className="bg-green-100 text-green-800">START NOW</Badge>
                          ) : now < new Date(test.startAt).getTime() ? (
                            <Badge className="bg-blue-100 text-blue-800">Upcoming</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-800">Closed</Badge>
                          )
                        ) : (
                          getStatusBadge(test.status)
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isExam ? (
                          now > new Date(test.endAt).getTime() ? (
                            <Button
                              onClick={() => navigate(`/student/tests/${test.id}/result`)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                              size="sm"
                            >
                              <FileCheck2 className="w-3 h-3 mr-1" /> Results
                            </Button>
                          ) : now < new Date(test.startAt).getTime() ? (
                            <Button disabled variant="outline" size="sm" className="text-xs">
                              Coming
                            </Button>
                          ) : (
                            <Button
                              onClick={() => navigate(`/student/tests/${test.id}`)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                              size="sm"
                            >
                              <Zap className="w-3 h-3 mr-1" /> Start
                            </Button>
                          )
                        ) : test.status === "active" ? (
                          <Button
                            onClick={() => window.open(test.cbtLink, "_blank")}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs"
                            size="sm"
                          >
                            <Zap className="w-3 h-3 mr-1" />
                            START NOW
                          </Button>
                        ) : (
                          <Button
                            disabled
                            variant="outline"
                            size="sm"
                            className="text-xs"
                          >
                            {test.status === "closed" ? "Closed" : "Coming"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* In-app CBT exams */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            In-app CBT Exams
          </h2>
          <Badge variant="outline" className="text-xs">
            Secure mode
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-600">Active</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold text-slate-900">
              {studentExams.active.length}
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-600">Upcoming</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold text-slate-900">
              {studentExams.upcoming.length}
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-600">Closed</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold text-slate-900">
              {studentExams.closed.length}
            </CardContent>
          </Card>
        </div>

        <TestTableSection title="Active Exams" tests={studentExams.active} icon={Zap} isExam />
        <TestTableSection
          title="Upcoming Exams"
          tests={studentExams.upcoming}
          icon={Calendar}
          isExam
        />
        <TestTableSection
          title="Previous Exams"
          tests={studentExams.closed}
          icon={CheckCircle2}
          isExam
        />

        {studentExams.all.length === 0 && !examLoading && (
          <Card>
            <CardContent className="pt-8 text-center pb-8">
              <Zap className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-600 font-medium">No in-app CBT exams yet</p>
              <p className="text-sm text-slate-500 mt-1">
                Your instructor will publish exams here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Legacy tests (external links) intentionally hidden to avoid confusion. */}
    </div>
  );
}
