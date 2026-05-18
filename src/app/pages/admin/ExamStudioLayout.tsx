import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { getExamTest, listAttemptsForAdmin, listPublicQuestions } from "../../features/exams/examApi";
import type { ExamTest } from "../../features/exams/types";
import { ArrowLeft } from "lucide-react";

export default function ExamStudioLayout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const testId = id || "";
  const [test, setTest] = useState<ExamTest | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!testId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [t, qs, attempts] = await Promise.all([
          getExamTest(testId),
          listPublicQuestions(testId),
          listAttemptsForAdmin(testId),
        ]);
        if (cancelled) return;
        setTest(t);
        setQuestionCount(qs.length);
        setAttemptCount(attempts.length);
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
  }, [testId, location.pathname]);

  const stepState = useMemo(() => {
    if (!test) return { settingsDone: false, questionsDone: false, published: false };
    return {
      settingsDone: Boolean(test.title.trim() && test.subject.trim() && test.startAt && test.endAt),
      questionsDone: questionCount > 0,
      published: test.status === "published",
    };
  }, [questionCount, test]);

  const isResultsPage = location.pathname.includes(`/admin/tests/${testId}/results`);

  if (loading) return <div className="text-sm text-slate-500">Loading test workspace...</div>;

  if (!test) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Test not found</AlertTitle>
        <AlertDescription>This test does not exist.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Button variant="ghost" className="-ml-3" onClick={() => navigate("/admin/tests")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Tests
          </Button>
          <div className="flex items-center gap-2 flex-wrap mt-1 mb-1">
            <h1 className="text-xl font-semibold text-slate-900 truncate">{test.title}</h1>
            <Badge variant="outline">{test.subject}</Badge>
            <Badge className={test.status === "published" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-800"}>
              {test.status === "published" ? "Published" : "Draft"}
            </Badge>
          </div>
          <p className="text-xs text-slate-500">Questions: {questionCount} • Attempts: {attemptCount}</p>
        </div>
        {isResultsPage ? null : questionCount === 0 ? (
          <Button
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={() => navigate(`/admin/tests/${testId}/questions`)}
          >
            Add Questions
          </Button>
        ) : (
          <Button
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={() => navigate(`/admin/tests/${testId}/publish`)}
          >
            Continue to Publish
          </Button>
        )}
      </div>

      <Outlet />
    </div>
  );
}

