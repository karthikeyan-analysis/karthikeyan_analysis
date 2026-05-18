import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import bannerImage from "../../../banner.jpeg";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { KeyRound, Loader2 } from "lucide-react";
import {
  getExamTest,
  listPasscodeGuestExamTests,
  verifyExamPasscode,
} from "../../features/exams/examApi";
import { allowsPasscodeGuestAccess } from "../../features/exams/settings";
import type { ExamTest } from "../../features/exams/types";

export default function GuestExamJoin() {
  const { testId: routeTestId } = useParams();
  const navigate = useNavigate();
  const { user, loginGuestForExam, loading: authLoading } = useAuth();

  const [tests, setTests] = useState<ExamTest[]>([]);
  const [testsLoading, setTestsLoading] = useState(true);
  const [selectedTestId, setSelectedTestId] = useState(routeTestId || "");
  const [test, setTest] = useState<ExamTest | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setTestsLoading(true);
      try {
        const list = await listPasscodeGuestExamTests();
        if (!cancelled) setTests(list);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setTestsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (routeTestId) setSelectedTestId(routeTestId);
  }, [routeTestId]);

  const effectiveTestId = selectedTestId || routeTestId || "";

  useEffect(() => {
    if (!effectiveTestId) {
      setTest(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setTestLoading(true);
      try {
        const t = await getExamTest(effectiveTestId);
        if (!cancelled) setTest(t);
      } catch (e) {
        console.error(e);
        if (!cancelled) setTest(null);
      } finally {
        if (!cancelled) setTestLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [effectiveTestId]);

  const guestAllowed = useMemo(() => (test ? allowsPasscodeGuestAccess(test) : false), [test]);

  const openJoinDialog = () => {
    setError("");
    if (!effectiveTestId) {
      setError("Select a test first.");
      return;
    }
    if (!test) {
      setError("Test not found or not available.");
      return;
    }
    if (!guestAllowed) {
      setError("This test does not allow passcode guest access.");
      return;
    }
    setDialogOpen(true);
  };

  const handleJoin = async () => {
    if (!test || !effectiveTestId) return;
    setError("");
    setSubmitting(true);
    try {
      const ok = await verifyExamPasscode(test, passcode);
      if (!ok) {
        setError("Incorrect passcode. Please try again.");
        return;
      }

      const result = await loginGuestForExam({
        name,
        email,
        testId: effectiveTestId,
      });
      if (!result.success) {
        setError(result.error || "Could not join test.");
        return;
      }

      setDialogOpen(false);
      navigate(`/student/tests/${effectiveTestId}`, { replace: true });
    } catch (e) {
      console.error(e);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") {
      navigate("/admin", { replace: true });
    }
  }, [user?.role, navigate]);

  if (authLoading) {
    return (
      <PageShell>
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </PageShell>
    );
  }

  if (user?.role === "admin") return null;

  if (user?.isGuestExamParticipant && user.guestExamTestId) {
    return (
      <PageShell>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Continue your test</CardTitle>
            <CardDescription>You are signed in as {user.name || "Guest"}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              onClick={() => navigate(`/student/tests/${user.guestExamTestId}`)}
            >
              Go to exam
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate("/student/tests")}>
              Test schedule
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Card className="w-full max-w-lg shadow-xl border-indigo-100 overflow-hidden">
        <div className="w-full bg-white px-3 py-3 flex items-center justify-center border-b">
          <img src={bannerImage} alt="Banner" className="max-h-14 object-contain" />
        </div>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="w-5 h-5 text-indigo-600" />
            Join test with passcode
          </CardTitle>
          <CardDescription>
            For students not enrolled in a batch. Enter the passcode from your instructor, then your
            name and email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {testsLoading ? (
            <div className="text-sm text-slate-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading available tests…
            </div>
          ) : tests.length === 0 ? (
            <Alert>
              <AlertTitle>No passcode tests</AlertTitle>
              <AlertDescription>
                There are no published tests open for passcode guests right now.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              <Label>Select test</Label>
              <Select value={selectedTestId} onValueChange={setSelectedTestId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a test" />
                </SelectTrigger>
                <SelectContent>
                  {tests.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title} — {t.subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {testLoading && effectiveTestId ? (
            <p className="text-xs text-slate-500">Loading test details…</p>
          ) : null}

          {test && guestAllowed ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <span className="font-medium">{test.title}</span>
              <span className="text-emerald-800"> — {test.subject}</span>
            </div>
          ) : test && !guestAllowed ? (
            <Alert variant="destructive">
              <AlertTitle>Not available</AlertTitle>
              <AlertDescription>This test is not configured for passcode guest access.</AlertDescription>
            </Alert>
          ) : null}

          {error && !dialogOpen ? <p className="text-sm text-rose-600">{error}</p> : null}

          <Button
            className="w-full bg-indigo-600 hover:bg-indigo-700"
            disabled={!effectiveTestId || testsLoading || testLoading || !guestAllowed}
            onClick={openJoinDialog}
          >
            Continue
          </Button>

          <p className="text-center text-sm text-slate-600">
            Enrolled student?{" "}
            <Link to="/login" className="text-indigo-600 hover:underline">
              Sign in with Google
            </Link>
          </p>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your details</DialogTitle>
            <DialogDescription>
              {test?.title ? `Joining: ${test.title}` : "Enter your information to start the test."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Passcode</Label>
              <Input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{test?.settings?.identityPrompt?.trim() || "Full name"}</Label>
              <Input value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={submitting || !passcode.trim() || !name.trim() || !email.trim()}
              onClick={() => void handleJoin()}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Starting…
                </>
              ) : (
                "Start test"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 p-4">
      {children}
    </div>
  );
}
