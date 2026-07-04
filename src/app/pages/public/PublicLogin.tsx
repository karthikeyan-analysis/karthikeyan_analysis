import { useState } from "react";
import { useNavigate } from "react-router";
import { usePublicAuth } from "../../context/PublicAuthContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Eye, EyeOff, LogIn } from "lucide-react";

export default function PublicLogin() {
  const navigate = useNavigate();
  const { login, publicStudent } = usePublicAuth();

  const [username, setUsername] = useState("");
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Already logged in
  if (publicStudent) {
    navigate("/public/dashboard", { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(username, passcode);
    setLoading(false);
    if (result.success) {
      navigate("/public/dashboard", { replace: true });
    } else {
      setError(result.error || "Login failed.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2">
            Karthikeyan Analysis Study Circle
          </p>
          <h1 className="text-2xl font-bold text-slate-900">CBT Mock Test Portal</h1>
          <p className="text-slate-500 text-sm mt-1">Login with your credentials</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toUpperCase())}
                placeholder="e.g. KASC26001"
                className="mt-1 tracking-widest font-semibold"
                autoComplete="off"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="passcode">Passcode</Label>
              <div className="relative mt-1">
                <Input
                  id="passcode"
                  type={showPasscode ? "text" : "password"}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value.toUpperCase())}
                  placeholder="6-character passcode"
                  className="pr-10 tracking-widest font-semibold"
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPasscode((v) => !v)}
                >
                  {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 h-11">
              <LogIn className="w-4 h-4 mr-2" />
              {loading ? "Logging in…" : "Login"}
            </Button>
          </form>

          <div className="pt-2 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500">
              Not registered yet?{" "}
              <button
                onClick={() => navigate("/public/register")}
                className="text-indigo-600 font-semibold hover:underline"
              >
                Register here
              </button>
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <p className="font-semibold mb-0.5">⚠ Single-device login</p>
            <p>Logging in here will automatically end any active session on another device.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
