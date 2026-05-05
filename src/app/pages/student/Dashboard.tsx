import { useEffect, useMemo, useState } from "react";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { BookOpen, Video, FileText, Clock, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";
import { listExamTestsForStudent } from "../../features/exams/examApi";
import type { ExamTest } from "../../features/exams/types";

export default function StudentDashboard() {
  const { content, videos, tests } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [examTests, setExamTests] = useState<ExamTest[]>([]);

  const canAccessItem = (item: {
    visibilityType: "ALL" | "SELECTIVE" | "BATCH";
    batchId?: string;
    selectedStudents?: string[];
  }) => {
    if (!user) return false;
    if (item.visibilityType === "ALL") return true;
    if (item.visibilityType === "BATCH") return !!user.batchId && item.batchId === user.batchId;
    return (
      item.selectedStudents?.includes(user.studentRecordId || "") ||
      item.selectedStudents?.includes(user.id) ||
      false
    );
  };

  const availableContent = content.filter((item) => canAccessItem(item));
  const availableVideos = videos.filter((video) => canAccessItem(video));

  useEffect(() => {
    if (!user?.batchId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const t = await listExamTestsForStudent({
          batchId: user.batchId,
          studentRecordId: user.studentRecordId,
        });
        if (!cancelled) setExamTests(t);
      } catch (e) {
        console.error(e);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.batchId, user?.studentRecordId]);

  const recentContent = [...availableContent]
    .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
    .slice(0, 3);
  const recentVideos = [...availableVideos]
    .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
    .slice(0, 2);

  const recentAnnouncements = useMemo(() => {
    const items = [
      ...recentContent.map((item) => ({
        id: `content-${item.id}`,
        title: "New course material shared",
        description: `${item.title} is now available in your library.`,
        time: item.uploadDate,
      })),
      ...recentVideos.map((video) => ({
        id: `video-${video.id}`,
        title: "New video lesson added",
        description: `${video.title} is now available to watch.`,
        time: video.uploadDate,
      })),
      ...examTests.map((t) => ({
        id: `exam-${t.id}`,
        title: `CBT Exam scheduled: ${t.title}`,
        description: `${t.subject} • ${new Date(t.startAt).toLocaleString()} – ${new Date(t.endAt).toLocaleString()}`,
        time: t.startAt,
      })),
      ...tests
        .filter((t) => user?.batchId && t.batchId === user.batchId)
        .map((test) => ({
          id: `test-${test.id}`,
          title: `Test ${test.testNo} scheduled`,
          description: `${test.portion} on ${test.testDate} (${test.startTime} - ${test.endTime})`,
          time: test.createdDate || test.testDate,
        })),
    ];

    return items
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 4);
  }, [recentContent, recentVideos, examTests, tests, user?.batchId]);

  const upcomingExamCount = useMemo(() => {
    const now = Date.now();
    return examTests.filter((t) => new Date(t.startAt).getTime() > now).length;
  }, [examTests]);

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Available Resources
            </CardTitle>
            <BookOpen className="w-5 h-5 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{availableContent.length}</div>
            <p className="text-xs text-slate-500 mt-1">Course materials</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Video Courses
            </CardTitle>
            <Video className="w-5 h-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{availableVideos.length}</div>
            <p className="text-xs text-slate-500 mt-1">Video lessons</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Upcoming CBT Exams
            </CardTitle>
            <FileText className="w-5 h-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">
              {upcomingExamCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              <button
                className="text-indigo-700 hover:underline"
                onClick={() => navigate("/student/tests")}
              >
                Open Test Schedule
              </button>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Resources</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/student/media")}>
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentContent.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-4 p-3 border border-slate-200 rounded-lg hover:border-indigo-200 hover:bg-indigo-50/50 transition-all cursor-pointer"
                onClick={() => navigate(`/student/pdf/${item.id}`)}
              >
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-slate-900">{item.title}</h4>
                  <p className="text-sm text-slate-600 line-clamp-1">{item.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {item.type.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-slate-500">{item.uploadDate}</span>
                  </div>
                </div>
              </div>
            ))}
            {recentContent.length === 0 && (
              <p className="text-sm text-slate-500">No recent resources available.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Videos</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/student/media")}>
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentVideos.map((video) => (
              <div
                key={video.id}
                className="group cursor-pointer"
                onClick={() => navigate(`/student/video/${video.id}`)}
              >
                <div className="relative aspect-video rounded-lg overflow-hidden mb-2">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                      <Video className="w-5 h-5 text-slate-900 ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-black/70 text-white hover:bg-black/70">
                      <Clock className="w-3 h-3 mr-1" />
                      {video.duration}
                    </Badge>
                  </div>
                </div>
                <h4 className="font-medium text-slate-900">{video.title}</h4>
                <p className="text-sm text-slate-600 line-clamp-2">{video.description}</p>
              </div>
            ))}
            {recentVideos.length === 0 && (
              <p className="text-sm text-slate-500">No recent videos available.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Announcements */}
      <Card className="border-slate-200 bg-gradient-to-br from-indigo-50 to-white">
        <CardHeader>
          <CardTitle>Announcements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentAnnouncements.length === 0 ? (
            <p className="text-sm text-slate-500">
              No announcements yet. New uploads and tests will appear here.
            </p>
          ) : (
            recentAnnouncements.map((announcement, index) => (
              <div
                key={announcement.id}
                className="p-4 bg-white rounded-lg border border-slate-200"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-2 h-2 rounded-full mt-2 ${index === 0 ? "bg-indigo-600" : "bg-slate-400"}`}
                  ></div>
                  <div>
                    <p className="font-medium text-slate-900">{announcement.title}</p>
                    <p className="text-sm text-slate-600 mt-1">
                      {announcement.description}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">{announcement.time}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
