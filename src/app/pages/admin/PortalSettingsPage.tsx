import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Settings2 } from "lucide-react";
import {
  DEFAULT_PORTAL_LOGIN_SETTINGS,
  getPortalLoginSettings,
  savePortalLoginSettings,
  type PortalLoginSettings,
} from "../../features/portal/portalLoginSettings";

export default function PortalSettingsPage() {
  const [settings, setSettings] = useState<PortalLoginSettings>(
    DEFAULT_PORTAL_LOGIN_SETTINGS,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await getPortalLoginSettings();
        if (!cancelled) setSettings(data);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setMessage({
            type: "error",
            text: "Could not load portal settings. Showing defaults.",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const saved = await savePortalLoginSettings({
        showGuestLoginButton: settings.showGuestLoginButton,
      });
      setSettings(saved);
      setMessage({
        type: "success",
        text: "Login page settings saved. Students will see the update on the next refresh.",
      });
    } catch (error: any) {
      console.error(error);
      setMessage({
        type: "error",
        text: error?.message || "Failed to save settings. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
          <Settings2 className="w-7 h-7 text-indigo-600" />
          Portal Settings
        </h1>
        <p className="text-slate-600 mt-1">
          Control what students see on the login page.
        </p>
      </div>

      {message ? (
        <div
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <p>{message.text}</p>
        </div>
      ) : null}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Student Login Page</CardTitle>
          <CardDescription>
            Google sign-in is always shown. Guest passcode join can be shown or hidden.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-600 text-sm py-6">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading settings…
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Google login</p>
                <p className="text-xs text-slate-600 mt-1">
                  Always visible on the student login page for every device and browser.
                </p>
              </div>

              <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4">
                <div className="space-y-1 min-w-0">
                  <Label htmlFor="guest-login-toggle" className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-indigo-600" />
                    Show guest login button
                  </Label>
                  <p className="text-xs text-slate-600">
                    When enabled, students see “Join test with passcode (no login)” on the login page.
                    Turn this off if you only want enrolled Google sign-in.
                  </p>
                </div>
                <Switch
                  id="guest-login-toggle"
                  checked={settings.showGuestLoginButton}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      showGuestLoginButton: checked,
                    }))
                  }
                />
              </div>

              <div className="flex justify-end">
                <Button
                  className="bg-indigo-600 hover:bg-indigo-700"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save Settings"
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
