import { Link } from "react-router";
import { useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  Users,
  FileText,
  Video,
  TrendingUp,
  FileSpreadsheet,
  ArrowUpRight,
  ClipboardList,
  UserPlus,
  Radio,
} from "lucide-react";

function greetingForHour(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { students, content, videos, tests, batches, loading } = useData();

  const activeStudents = students.filter((s) => s.status === "active").length;
  const inactiveStudents = students.length - activeStudents;
  const activeStudentPercent =
    students.length > 0 ? Math.round((activeStudents / students.length) * 100) : 0;

  const stats = [
    {
      title: "Students",
      value: students.length,
      icon: Users,
      accent: "text-sky-700 bg-sky-50 ring-sky-100",
      detail: `${inactiveStudents} inactive`,
    },
    {
      title: "Active",
      value: activeStudents,
      icon: TrendingUp,
      accent: "text-emerald-700 bg-emerald-50 ring-emerald-100",
      detail: `${activeStudentPercent}% of roster`,
    },
    {
      title: "Batches",
      value: batches.length,
      icon: ClipboardList,
      accent: "text-indigo-700 bg-indigo-50 ring-indigo-100",
      detail: `${content.length} content items`,
    },
    {
      title: "Videos",
      value: videos.length,
      icon: Video,
      accent: "text-violet-700 bg-violet-50 ring-violet-100",
      detail: `${tests.length} tests on record`,
    },
  ];

  const parseDate = (dateValue?: string) => {
    if (!dateValue) return 0;
    const parsed = new Date(dateValue).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const getRelativeTime = (dateValue?: string) => {
    if (!dateValue) return "date unavailable";
    const parsedTime = parseDate(dateValue);
    if (!parsedTime) return "date unavailable";

    const seconds = Math.floor((Date.now() - parsedTime) / 1000);
    if (seconds < 60) return "just now";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const recentActivity = useMemo(() => {
    const studentActivity = students.map((student) => ({
      action: "Student enrolled",
      actor: student.name || student.email || "Unknown student",
      date: student.enrolledDate,
      timestamp: parseDate(student.enrolledDate),
      tone: "bg-sky-500",
    }));

    const contentActivity = content.map((item) => ({
      action: "Content uploaded",
      actor: item.title || "Untitled content",
      date: item.uploadDate,
      timestamp: parseDate(item.uploadDate),
      tone: "bg-indigo-500",
    }));

    const videoActivity = videos.map((video) => ({
      action: "Video uploaded",
      actor: video.title || "Untitled video",
      date: video.uploadDate,
      timestamp: parseDate(video.uploadDate),
      tone: "bg-violet-500",
    }));

    const testActivity = tests.map((test) => ({
      action: "Test created",
      actor: `Test ${test.testNo}`,
      date: test.createdDate,
      timestamp: parseDate(test.createdDate),
      tone: "bg-emerald-500",
    }));

    return [...studentActivity, ...contentActivity, ...videoActivity, ...testActivity]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 7);
  }, [students, content, videos, tests]);

  const quickActions = [
    {
      to: "/admin/live-classes",
      title: "Live Classes",
      desc: "Start a class or review recordings",
      icon: Radio,
      className: "from-indigo-600 to-indigo-700 text-white",
      iconWrap: "bg-white/15",
    },
    {
      to: "/admin/students",
      title: "Students",
      desc: "Add and manage student records",
      icon: Users,
      className: "bg-white border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/40",
      iconWrap: "bg-sky-50 text-sky-700",
    },
    {
      to: "/admin/co-hosts",
      title: "Co-Hosts",
      desc: "Create teacher login credentials",
      icon: UserPlus,
      className: "bg-white border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/40",
      iconWrap: "bg-indigo-50 text-indigo-700",
    },
    {
      to: "/admin/media",
      title: "Media",
      desc: "Upload PDFs and video lessons",
      icon: FileText,
      className: "bg-white border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/40",
      iconWrap: "bg-violet-50 text-violet-700",
    },
    {
      to: "/admin/tests",
      title: "Tests",
      desc: "Create and publish CBT exams",
      icon: ClipboardList,
      className: "bg-white border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/40",
      iconWrap: "bg-emerald-50 text-emerald-700",
    },
    {
      to: "/admin/reports/student-tests",
      title: "Reports",
      desc: "Export marks and attendance",
      icon: FileSpreadsheet,
      className: "bg-white border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/40",
      iconWrap: "bg-amber-50 text-amber-700",
    },
  ];

  const firstName = (user?.name || "Admin").split(" ")[0];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Welcome */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 px-5 py-6 text-white shadow-sm sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-slate-300">{greetingForHour()}, {firstName}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Admin overview
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              Manage batches, live classes, tests, and student progress from one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="bg-indigo-500 hover:bg-indigo-400 text-white shadow-none">
              <Link to="/admin/live-classes">
                <Radio className="mr-2 h-4 w-4" />
                Open Live Classes
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Link to="/admin/students">Manage students</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className="border-slate-200/80 bg-white/90 shadow-none transition-shadow hover:shadow-sm"
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {stat.title}
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{stat.detail}</p>
                </div>
                <div className={`rounded-xl p-2.5 ring-1 ${stat.accent}`}>
                  <stat.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Quick Actions */}
        <Card className="border-slate-200/80 shadow-none xl:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900">Quick actions</CardTitle>
            <p className="text-sm text-slate-500">Jump to the tools you use most.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {quickActions.map((action, idx) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className={`group flex items-start gap-3 rounded-xl p-4 transition-all ${
                    idx === 0
                      ? `bg-gradient-to-br ${action.className} shadow-sm`
                      : action.className
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${action.iconWrap} ${
                      idx === 0 ? "text-white" : ""
                    }`}
                  >
                    <action.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`font-medium ${idx === 0 ? "text-white" : "text-slate-900"}`}>
                        {action.title}
                      </p>
                      <ArrowUpRight
                        className={`h-4 w-4 shrink-0 opacity-60 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 ${
                          idx === 0 ? "text-white" : "text-slate-400"
                        }`}
                      />
                    </div>
                    <p className={`mt-0.5 text-sm ${idx === 0 ? "text-indigo-100" : "text-slate-500"}`}>
                      {action.desc}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-slate-200/80 shadow-none xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900">Recent activity</CardTitle>
            <p className="text-sm text-slate-500">Latest updates across the portal.</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">Loading activity…</p>
            ) : recentActivity.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
                <p className="text-sm text-slate-500">
                  No activity yet. Add students, content, or tests to see updates here.
                </p>
              </div>
            ) : (
              <ul className="space-y-1">
                {recentActivity.map((activity, index) => (
                  <li
                    key={`${activity.action}-${activity.actor}-${index}`}
                    className="flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50"
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${activity.tone}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{activity.action}</p>
                      <p className="truncate text-xs text-slate-500">{activity.actor}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {getRelativeTime(activity.date)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
