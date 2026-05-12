import { Link } from "react-router";
import { useMemo } from "react";
import { useData } from "../../context/DataContext";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Users, FileText, Video, TrendingUp, FileSpreadsheet } from "lucide-react";

export default function AdminDashboard() {
  const { students, content, videos, tests, loading } = useData();

  const activeStudents = students.filter((s) => s.status === "active").length;
  const inactiveStudents = students.length - activeStudents;
  const activeStudentPercent =
    students.length > 0 ? Math.round((activeStudents / students.length) * 100) : 0;

  const stats = [
    {
      title: "Total Students",
      value: students.length,
      icon: Users,
      color: "bg-blue-500",
      detail: `${inactiveStudents} inactive`,
    },
    {
      title: "Active Students",
      value: activeStudents,
      icon: TrendingUp,
      color: "bg-green-500",
      detail: `${activeStudentPercent}% of all students`,
    },
    {
      title: "Content Items",
      value: content.length,
      icon: FileText,
      color: "bg-indigo-500",
      detail: "PDFs, docs, and notes",
    },
    {
      title: "Video Courses",
      value: videos.length,
      icon: Video,
      color: "bg-purple-500",
      detail: `${tests.length} total tests scheduled`,
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
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  };

  const recentActivity = useMemo(() => {
    const studentActivity = students.map((student) => ({
      action: "Student enrolled",
      actor: student.name || student.email || "Unknown student",
      date: student.enrolledDate,
      timestamp: parseDate(student.enrolledDate),
    }));

    const contentActivity = content.map((item) => ({
      action: "Content uploaded",
      actor: item.title || "Untitled content",
      date: item.uploadDate,
      timestamp: parseDate(item.uploadDate),
    }));

    const videoActivity = videos.map((video) => ({
      action: "Video uploaded",
      actor: video.title || "Untitled video",
      date: video.uploadDate,
      timestamp: parseDate(video.uploadDate),
    }));

    const testActivity = tests.map((test) => ({
      action: "Test created",
      actor: `Test ${test.testNo}`,
      date: test.createdDate,
      timestamp: parseDate(test.createdDate),
    }));

    return [...studentActivity, ...contentActivity, ...videoActivity, ...testActivity]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 8);
  }, [students, content, videos, tests]);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {stat.title}
              </CardTitle>
              <div className={`${stat.color} p-2 rounded-lg`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{stat.value}</div>
              <p className="text-xs text-slate-500 mt-1">{stat.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">Loading activity...</p>
            ) : recentActivity.length === 0 ? (
              <p className="text-sm text-slate-500">
                No activity yet. Add students, content, videos, or tests to see updates.
              </p>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div
                    key={`${activity.action}-${activity.actor}-${index}`}
                    className="flex items-start gap-4 pb-4 border-b last:border-b-0 last:pb-0"
                  >
                    <div className="w-2 h-2 bg-indigo-600 rounded-full mt-2"></div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{activity.action}</p>
                      <p className="text-sm text-slate-600">{activity.actor}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {getRelativeTime(activity.date)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/admin/students" className="block">
              <Button
                variant="ghost"
                className="w-full h-auto p-4 justify-start text-left border border-slate-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Manage Students</p>
                    <p className="text-sm text-slate-600">
                      Add and update student records
                    </p>
                  </div>
                </div>
              </Button>
            </Link>

            <Link to="/admin/media" className="block">
              <Button
                variant="ghost"
                className="w-full h-auto p-4 justify-start text-left border border-slate-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Manage Content</p>
                    <p className="text-sm text-slate-600">
                      Upload and organize learning materials
                    </p>
                  </div>
                </div>
              </Button>
            </Link>

            <Link to="/admin/tests" className="block">
              <Button
                variant="ghost"
                className="w-full h-auto p-4 justify-start text-left border border-slate-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-pink-600 rounded-lg flex items-center justify-center">
                    <Video className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Manage Tests</p>
                    <p className="text-sm text-slate-600">
                      Schedule and maintain batch tests
                    </p>
                  </div>
                </div>
              </Button>
            </Link>

            <Link to="/admin/reports/student-tests" className="block">
              <Button
                variant="ghost"
                className="w-full h-auto p-4 justify-start text-left border border-slate-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Student test reports</p>
                    <p className="text-sm text-slate-600">
                      Export marks and attendance for chosen students
                    </p>
                  </div>
                </div>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
