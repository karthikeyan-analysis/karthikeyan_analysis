import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import * as XLSX from "xlsx";
import { useData } from "../../context/DataContext";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { getLiveClass, listAttendanceForAdmin } from "../../features/liveClasses/liveClassApi";
import { getLiveClassBatchIds } from "../../features/liveClasses/liveClassBatchUtils";
import type { LiveClass, LiveClassAttendance } from "../../features/liveClasses/types";

interface Row {
  studentId: string;
  name: string;
  email: string;
  attended: boolean;
  durationLabel: string;
  totalDurationSec: number;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

export default function LiveClassAttendance() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { students } = useData();

  const [cls, setCls] = useState<LiveClass | null>(null);
  const [attendance, setAttendance] = useState<LiveClassAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [clsData, attendanceData] = await Promise.all([
          getLiveClass(id),
          listAttendanceForAdmin(id),
        ]);
        if (!cancelled) {
          setCls(clsData);
          setAttendance(attendanceData);
        }
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
  }, [id]);

  const enrolledStudents = useMemo(() => {
    if (!cls) return [];
    const batchIds = getLiveClassBatchIds(cls);
    return students.filter((s) => {
      const sBatchIds = s.batchIds?.length ? s.batchIds : s.batchId ? [s.batchId] : [];
      return sBatchIds.some((b) => batchIds.includes(b));
    });
  }, [cls, students]);

  const rows: Row[] = useMemo(() => {
    const byStudentId = new Map(attendance.map((a) => [a.studentRecordId, a]));
    return enrolledStudents
      .map((s) => {
        const a = byStudentId.get(s.id);
        const totalDurationSec = a?.totalDurationSec || 0;
        return {
          studentId: s.studentId,
          name: s.name,
          email: s.email,
          attended: !!a && (a.sessions?.length > 0 || !!a.currentSessionJoinedAt),
          durationLabel: totalDurationSec > 0 ? formatDuration(totalDurationSec) : "—",
          totalDurationSec,
        };
      })
      .sort((a, b) => {
        if (a.attended !== b.attended) return a.attended ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [enrolledStudents, attendance]);

  const attendedCount = rows.filter((r) => r.attended).length;

  const exportExcel = () => {
    const data = rows.map((r) => ({
      "Student ID": r.studentId,
      Name: r.name,
      Email: r.email,
      Status: r.attended ? "Attended" : "Not Attended",
      "Time in class": r.durationLabel,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    const fileName = `${(cls?.name || "live-class").replace(/[\\/:*?"<>|]+/g, "_")}_attendance.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/live-classes")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{cls?.name || "Attendance"}</h1>
            <p className="text-sm text-slate-500">{cls?.subject}</p>
          </div>
        </div>
        <Button onClick={exportExcel} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
          <Download className="h-4 w-4" />
          Export Excel
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Enrolled</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-slate-900">{rows.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Attended</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-emerald-600">{attendedCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Not Attended</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-red-600">{rows.length - attendedCount}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance</CardTitle>
          <CardDescription>Based on join/leave events recorded during the live class.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Time in class</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-slate-500">
                      No enrolled students found for this class's batch(es).
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.studentId}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.studentId}</TableCell>
                      <TableCell className="text-sm text-slate-500">{r.email}</TableCell>
                      <TableCell>
                        <Badge variant={r.attended ? "default" : "outline"} className={r.attended ? "bg-emerald-600" : ""}>
                          {r.attended ? "Attended" : "Not Attended"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{r.durationLabel}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
