import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { getExamTest, listAttemptsForAdmin, listPublicQuestions } from "../../features/exams/examApi";
import {
  allowsPasscodeGuestAccess,
  guestJoinUrl,
  isPasscodeGuestTestConfigured,
} from "../../features/exams/settings";
import type { ExamAttempt, ExamTest } from "../../features/exams/types";
import { Link2 } from "lucide-react";
import { CopyGuestLinkButton } from "../../components/exams/CopyGuestLinkButton";

export default function ExamDashboardPage() {
  const { id } = useParams();
  const testId = id || "";
  const [test, setTest] = useState<ExamTest | null>(null);
  const [questions, setQuestions] = useState(0);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!testId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [t, qs, a] = await Promise.all([
          getExamTest(testId),
          listPublicQuestions(testId),
          listAttemptsForAdmin(testId),
        ]);
        if (cancelled) return;
        setTest(t);
        setQuestions(qs.length);
        setAttempts(a);
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

  const submitted = useMemo(() => attempts.filter((a) => a.status === "submitted").length, [attempts]);

  if (loading) return <div className="text-sm text-slate-500">Loading dashboard...</div>;
  if (!test) return null;

  const showGuestLink = isPasscodeGuestTestConfigured(test);
  const guestLinkLive = allowsPasscodeGuestAccess(test);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Questions" value={String(questions)} />
            <StatCard label="Attempts" value={String(attempts.length)} />
            <StatCard label="Submissions" value={String(submitted)} />
            <StatCard label="Status" value={test.status === "published" ? "Published" : "Draft"} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button className="bg-indigo-600 hover:bg-indigo-700" asChild>
              <Link to={`/admin/tests/${testId}/settings`}>Setup Test</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/admin/tests/${testId}/questions`}>Manage Questions</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/admin/tests/${testId}/publish`}>Publish</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {showGuestLink ? (
        <GuestLinkCard test={test} isLive={guestLinkLive} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TaskRow
            index={1}
            title="Adjust settings"
            description="Change test name, description, timer, access, and review behavior."
            href={`/admin/tests/${testId}/settings`}
          />
          <TaskRow
            index={2}
            title="Add questions"
            description="Build a complete question bank with options, marks, and keys."
            href={`/admin/tests/${testId}/questions`}
          />
          <TaskRow
            index={3}
            title="Publish & distribute"
            description="Review readiness and publish the test for your students."
            href={`/admin/tests/${testId}/publish`}
          />
          <TaskRow
            index={4}
            title="View results"
            description="Track student performance and export score sheets."
            href={`/admin/tests/${testId}/results`}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function TaskRow(props: { index: number; title: string; description: string; href: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-slate-900">
          {props.index}. {props.title}
        </div>
        <div className="text-sm text-slate-600 mt-1">{props.description}</div>
      </div>
      <Button variant="outline" asChild>
        <Link to={props.href}>Open</Link>
      </Button>
    </div>
  );
}

function StatCard(props: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 bg-white">
      <div className="text-xs text-slate-500">{props.label}</div>
      <div className="text-lg font-semibold text-slate-900 mt-0.5">{props.value}</div>
    </div>
  );
}

function GuestLinkCard(props: { test: ExamTest; isLive: boolean }) {
  const url = guestJoinUrl(props.test.id);

  return (
    <Card className="border-indigo-200 bg-indigo-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="w-4 h-4 text-indigo-600" />
          Guest passcode link
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-600">
          Share this link with unenrolled students. They enter the passcode, name, and email before
          starting the test.
        </p>
        {!props.isLive ? (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            Publish this test before guests can join from this link.
          </p>
        ) : (
          <Badge className="bg-emerald-100 text-emerald-800">Live for guests</Badge>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            readOnly
            value={url}
            className="font-mono text-xs bg-white"
            onFocus={(e) => e.target.select()}
          />
          <CopyGuestLinkButton test={props.test} variant="outline" className="shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

