import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import bannerImage from "../../../banner.jpeg";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import {
  ArrowRight,
  KeyRound,
  Loader2,
  UserCheck,
  AlertCircle,
} from "lucide-react";
import {
  getExamTest,
  listPasscodeGuestExamTests,
  verifyExamPasscode,
} from "../../features/exams/examApi";
import { isExamManuallyClosed } from "../../features/exams/examAvailability";
import type { ExamTest } from "../../features/exams/types";

export default function GuestExamJoin() {
  const { testId: routeTestId } = useParams();
  const navigate = useNavigate();
  const { user, loginGuestForExam, logout, loading: authLoading } = useAuth();

  const [tests, setTests] = useState<ExamTest[]>([]);
  const [testsLoading, setTestsLoading] = useState(true);
  const [selectedTestId, setSelectedTestId] = useState(routeTestId || "");
  const [test, setTest] = useState<ExamTest | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const [passcode, setPasscode] = useState("");
  const [name, setName] = useState(
    user?.isGuestExamParticipant ? user.name || "" : "",
  );
  const [email, setEmail] = useState(
    user?.isGuestExamParticipant ? user.email || "" : "",
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showDifferentEntry, setShowDifferentEntry] = useState(false);

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

  useEffect(() => {
    if (user?.role === "admin") {
      navigate("/admin", { replace: true });
    }
  }, [user?.role, navigate]);

  const requiresPasscode = Boolean(test?.accessPasswordHash);

  const isNameValid = name.trim().length >= 2;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isPasscodeValid = !requiresPasscode || passcode.trim().length > 0;
  const isFormValid =
    Boolean(effectiveTestId) && isNameValid && isEmailValid && isPasscodeValid;

  const handleContinue = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!effectiveTestId) {
      setError("Please select a test.");
      return;
    }
    if (!test) {
      setError("Test information is still loading. Please wait.");
      return;
    }
    if (!isNameValid) {
      setError("Please enter your full name (at least 2 characters).");
      return;
    }
    if (!isEmailValid) {
      setError("Please enter a valid email address.");
      return;
    }
    if (requiresPasscode && !passcode.trim()) {
      setError("Please enter the test passcode.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      if (requiresPasscode) {
        const ok = await verifyExamPasscode(test, passcode.trim());
        if (!ok) {
          setError(
            "Incorrect passcode. Please check with your instructor and try again.",
          );
          setSubmitting(false);
          return;
        }
      }

      const result = await loginGuestForExam({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        testId: effectiveTestId,
      });

      if (!result.success) {
        setError(
          result.error || "Could not start guest session. Please try again.",
        );
        setSubmitting(false);
        return;
      }

      navigate(`/student/tests/${effectiveTestId}`, { replace: true });
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "An unexpected error occurred. Please try again.");
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <PageShell>
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </PageShell>
    );
  }

  if (user?.role === "admin") return null;

  // Active guest session for this test
  const hasActiveSessionForThisTest =
    !showDifferentEntry &&
    user?.isGuestExamParticipant &&
    user.guestExamTestId &&
    (!routeTestId || user.guestExamTestId === routeTestId);

  return (
    <PageShell>
      <Card className="w-full max-w-lg shadow-xl border-indigo-100 overflow-hidden">
        <div className="w-full bg-white px-4 py-3 flex items-center justify-center border-b">
          <img
            src={bannerImage}
            alt="Banner"
            className="max-h-14 object-contain"
          />
        </div>

        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="w-5 h-5 text-indigo-600" />
            Guest Test Entry
          </CardTitle>
          <CardDescription>
            Enter your details to access the test. Passcode is provided by your
            instructor.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {hasActiveSessionForThisTest ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-2">
                <div className="flex items-center gap-2 text-indigo-900 font-semibold">
                  <UserCheck className="w-5 h-5 text-indigo-600" />
                  Active Guest Session
                </div>
                <p className="text-sm text-indigo-800">
                  You are signed in as <strong>{user?.name || "Guest"}</strong>{" "}
                  ({user?.email}).
                </p>
                {test && (
                  <p className="text-xs text-indigo-700 font-medium">
                    Test: {test.title} — {test.subject}
                  </p>
                )}
              </div>

              <Button
                className="w-full bg-indigo-600 hover:bg-indigo-700 font-semibold"
                onClick={() =>
                  navigate(`/student/tests/${user?.guestExamTestId}`)
                }
              >
                Continue to Exam
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setShowDifferentEntry(true)}
                  className="text-indigo-600 hover:underline"
                >
                  Enter with different details
                </button>
                <Link
                  to="/student/tests"
                  className="text-slate-500 hover:underline"
                >
                  View Schedule
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleContinue} className="space-y-4">
              {/* Test Selection or Info */}
              {routeTestId && test ? (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-3.5 py-2.5 text-sm">
                  <p className="font-semibold text-indigo-950">{test.title}</p>
                  <p className="text-xs text-indigo-700 mt-0.5">
                    {test.subject} • {test.durationMinutes || 60} mins
                  </p>
                </div>
              ) : testsLoading ? (
                <div className="text-sm text-slate-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading available
                  tests…
                </div>
              ) : tests.length === 0 ? (
                <Alert>
                  <AlertTitle>No guest tests available</AlertTitle>
                  <AlertDescription>
                    There are no open tests available for guests right now.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="test-select">Select Test</Label>
                  <Select
                    value={selectedTestId}
                    onValueChange={(val) => {
                      setSelectedTestId(val);
                      setError("");
                    }}
                  >
                    <SelectTrigger id="test-select">
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
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading test
                  details…
                </p>
              ) : null}

              {test && isExamManuallyClosed(test) ? (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4" />
                  <AlertTitle>Test closed</AlertTitle>
                  <AlertDescription>
                    This test has been closed by the instructor and is no longer
                    accepting entries.
                  </AlertDescription>
                </Alert>
              ) : null}

              {/* Full Name */}
              <div className="space-y-1.5">
                <Label htmlFor="guest-name">
                  Full Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="guest-name"
                  placeholder="Enter your full name"
                  value={name}
                  autoComplete="name"
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError("");
                  }}
                  disabled={submitting}
                />
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <Label htmlFor="guest-email">
                  Email Address <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="guest-email"
                  type="email"
                  placeholder="student@example.com"
                  value={email}
                  autoComplete="email"
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError("");
                  }}
                  disabled={submitting}
                />
              </div>

              {/* Passcode (Required if test has passcode) */}
              {requiresPasscode && (
                <div className="space-y-1.5">
                  <Label htmlFor="guest-passcode">
                    Passcode <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="guest-passcode"
                    type="password"
                    placeholder="Enter test passcode"
                    value={passcode}
                    autoComplete="current-password"
                    onChange={(e) => {
                      setPasscode(e.target.value);
                      if (error) setError("");
                    }}
                    disabled={submitting}
                  />
                  <p className="text-xs text-slate-500">
                    Enter the access passcode provided by your instructor.
                  </p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <Alert variant="destructive" className="py-2.5">
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription className="text-xs">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Continue Button */}
              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                disabled={submitting || testLoading || !isFormValid}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Starting test…
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>

              <div className="pt-2 text-center text-xs text-slate-500 space-y-1">
                <p>
                  Enrolled student?{" "}
                  <Link
                    to="/login"
                    className="text-indigo-600 font-medium hover:underline"
                  >
                    Sign in with Google
                  </Link>
                </p>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
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
