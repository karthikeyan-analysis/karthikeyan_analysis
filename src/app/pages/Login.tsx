import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import bannerImage from "../../banner.jpeg";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "../components/ui/card";
import { AlertCircle } from "lucide-react";
import type { UserRole } from "../context/AuthContext";

interface LoginProps {
  role?: UserRole;
}

export default function Login({ role = "student" }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, loginStudentWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const success = await login(email, password, role);
      if (success) {
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
    const result = await loginStudentWithGoogle();
    if (result.success) {
      navigate("/student");
    } else {
      setError(result.error || "Google sign-in failed.");
    }
    setLoading(false);
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
            onSubmit={role === "admin" ? handleSubmit : undefined}
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
              <Button
                type="button"
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                onClick={handleStudentGoogleLogin}
                disabled={loading}
              >
                {loading ? "Connecting to Google..." : "Continue with Google"}
              </Button>
            )}

            <div className="pt-4 border-t">
              <p className="text-xs text-center text-slate-500">
                {role === "admin"
                  ? "Use your email and password registered in Firebase to sign in."
                  : "Students can sign in only with their admin-registered Google account."}
              </p>
              {role === "admin" && (
                <p className="text-sm text-center text-slate-600 mt-2">
                  Need an admin account?{" "}
                  <Link
                    to="/admin/signup"
                    className="text-indigo-600 hover:underline"
                  >
                    Create one
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
