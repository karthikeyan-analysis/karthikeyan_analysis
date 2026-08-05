import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import bannerImage from "../../banner.jpeg";
import { consumeGoogleLoginError, useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "../components/ui/card";
import { AlertCircle, KeyRound, Smartphone } from "lucide-react";
import type { UserRole } from "../context/AuthContext";
import {
  DEFAULT_PORTAL_LOGIN_SETTINGS,
  getPortalLoginSettings,
} from "../features/portal/portalLoginSettings";

interface LoginProps {
  role?: UserRole;
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.2 35.3 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4-4.1 5.3l.1.1 6.3 5.2C39.2 36.3 44 31 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}

export default function Login({ role = "student" }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [kickedNotice, setKickedNotice] = useState(false);
  const [showGuestLoginButton, setShowGuestLoginButton] = useState(
    DEFAULT_PORTAL_LOGIN_SETTINGS.showGuestLoginButton,
  );
  const { user, login, loginStudentWithGoogle, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionStorage.getItem("ka_kicked_reason") === "other_device") {
      setKickedNotice(true);
      sessionStorage.removeItem("ka_kicked_reason");
    }
    const googleError = consumeGoogleLoginError();
    if (googleError) setError(googleError);
  }, []);

  useEffect(() => {
    if (role !== "student") return;
    let cancelled = false;
    getPortalLoginSettings()
      .then((settings) => {
        if (!cancelled) setShowGuestLoginButton(settings.showGuestLoginButton);
      })
      .catch(() => {
        if (!cancelled) {
          setShowGuestLoginButton(
            DEFAULT_PORTAL_LOGIN_SETTINGS.showGuestLoginButton,
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  // After redirect-based Google login, AuthContext hydrates the student user.
  useEffect(() => {
    if (authLoading || loading) return;
    if (role === "student" && user?.role === "student") {
      const ids = user.batchIds?.length
        ? user.batchIds
        : user.batchId
          ? [user.batchId]
          : [];
      if (ids.length > 1 && (!user.batchId || !ids.includes(user.batchId))) {
        navigate("/student/select-batch", { replace: true });
      } else {
        navigate("/student", { replace: true });
      }
    }
    if (role === "admin" && user?.role === "admin") {
      navigate(user.adminKind === "cohost" ? "/admin/live-classes" : "/admin", { replace: true });
    }
  }, [authLoading, loading, navigate, role, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const success = await login(email, password, role);
      if (success) {
        // Co-hosts are redirected by the effect above once user.adminKind is set;
        // fall back to /admin which AdminOnlyRoute remaps for co-hosts.
        navigate(role === "admin" ? "/admin" : "/student");
      } else {
        setError("Invalid email or password. Please check your credentials.");
      }
    } catch (err: any) {
      const errorMessage =
        err?.message || "An error occurred. Please try again.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await loginStudentWithGoogle();
      if (!result.success) {
        setError(result.error || "Google sign-in failed.");
      }
      // On popup success: setLoading(false) fires in `finally` below, then the
      // useEffect watching [authLoading, loading, user] handles navigation once
      // AuthContext has set the user. Having navigate() here AND in the effect
      // created a race that left `loading` stuck true and blocked the effect gate.
      //
      // On redirect initiation: the browser replaces this page immediately;
      // the finally runs before unload but it doesn't matter — component unmounts.
    } catch (err: any) {
      setError(err?.message || "Google sign-in failed. Please try again.");
    } finally {
      // Always clear local loading so the navigation useEffect can fire.
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl border-indigo-100 overflow-hidden">
        <div className="w-full bg-white px-3 py-3 sm:px-4 sm:py-4 flex items-center justify-center">
          <img
            src={bannerImage}
            alt="EduHub banner"
            className="block h-auto w-auto max-w-full max-h-14 sm:max-h-24 object-contain"
          />
        </div>
        <CardHeader className="space-y-3 text-center">
          <CardDescription className="text-base">
            {role === "admin"
              ? "Secure Admin Portal Access"
              : "Secure Student Portal Access"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={role === "admin" ? handleSubmit : (e) => e.preventDefault()}
            className="space-y-5"
          >
            {role === "admin" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@edu.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-white"
                  />
                </div>
              </>
            )}

            {kickedNotice && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <Smartphone className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  You were signed out because your account was logged in on another device. Contact your admin if this wasn't you.
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {role === "admin" ? (
              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            ) : (
              <div className="space-y-3">
                {/* Always render Google login — never hide behind feature checks */}
                <Button
                  type="button"
                  className="w-full h-12 text-base font-semibold bg-white text-slate-900 border-2 border-slate-300 hover:bg-slate-50 hover:border-slate-400 shadow-sm"
                  onClick={handleStudentGoogleLogin}
                  disabled={loading || authLoading}
                  aria-label="Continue with Google"
                >
                  <GoogleMark className="w-5 h-5 mr-3 shrink-0" />
                  {loading ? "Connecting to Google..." : "Continue with Google"}
                </Button>

                <p className="text-xs text-center text-slate-500">
                  Use the Google account registered by your admin. Works on all browsers and devices.
                </p>

                {showGuestLoginButton ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-indigo-200 hover:bg-indigo-50"
                    disabled={loading || authLoading}
                    onClick={() => navigate("/student/join-test")}
                  >
                    <KeyRound className="w-4 h-4 mr-2" />
                    Join test with passcode (no login)
                  </Button>
                ) : null}
              </div>
            )}

            <div className="pt-4 border-t">
              <p className="text-xs text-center text-slate-500">
                {role === "admin"
                  ? "Admins and co-hosts sign in here with the email and password shared with them."
                  : "Students can sign in only with their admin-registered Google account."}
              </p>
              {role === "admin" && (
                <p className="text-sm text-center text-slate-600 mt-2">
                  Co-hosts: use the credentials from Co-Host Management.{" "}
                  Full admins:{" "}
                  <Link
                    to="/admin/signup"
                    className="text-indigo-600 hover:underline"
                  >
                    create an admin account
                  </Link>
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
