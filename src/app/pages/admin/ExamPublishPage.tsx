import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { getExamTest, listPublicQuestions, updateExamTest } from "../../features/exams/examApi";
import type { ExamTest } from "../../features/exams/types";

export default function ExamPublishPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const testId = id || "";
  const [test, setTest] = useState<ExamTest | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!testId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [t, qs] = await Promise.all([getExamTest(testId), listPublicQuestions(testId)]);
        if (cancelled) return;
        setTest(t);
        setQuestionCount(qs.length);
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
  }, [testId]);

  const warnings = useMemo(() => {
    if (!test) return [];
    const list: string[] = [];
    if (questionCount === 0) list.push("Your test doesn't have any questions.");
    if (!test.instructions?.trim()) list.push("No introduction text is set.");
    if ((test.durationMinutes || 0) < 5) list.push("Duration is very low.");
    if ((test.endAt && test.startAt) && new Date(test.endAt).getTime() <= new Date(test.startAt).getTime()) {
      list.push("Schedule window is invalid.");
    }
    return list;
  }, [questionCount, test]);

  const publish = async () => {
    if (!test) return;
    setPublishing(true);
    try {
      await updateExamTest(testId, {
        status: "published",
        publishedAt: new Date().toISOString(),
      });
      setTest({ ...test, status: "published", publishedAt: new Date().toISOString() });
      alert("Test published successfully.");
    } catch (e) {
      console.error(e);
      alert("Failed to publish test.");
    } finally {
      setPublishing(false);
    }
  };

  if (loading || !test) return <div className="text-sm text-slate-500">Loading publish panel...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Publish {test.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">
            You need to publish your test to make it available for your students to take. You can
            edit your test even after publishing.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{questionCount} questions</Badge>
            <Badge variant="outline">{test.totalMarks} marks</Badge>
            <Badge variant="outline">{test.status === "published" ? "Published" : "Draft"}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ready to publish?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {warnings.length === 0 ? (
            <Alert className="border-emerald-200 bg-emerald-50">
              <AlertTitle>Looks good</AlertTitle>
              <AlertDescription>No major issues were found.</AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertTitle>Review these warnings</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-5 space-y-1">
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => void publish()} disabled={publishing}>
              {publishing ? "Publishing..." : "Publish Test"}
            </Button>
            <Button variant="outline" onClick={() => navigate(`/admin/tests/${testId}/settings`)}>
              Edit Setup
            </Button>
            <Button variant="outline" onClick={() => navigate(`/admin/tests/${testId}/questions`)}>
              Edit Questions
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

