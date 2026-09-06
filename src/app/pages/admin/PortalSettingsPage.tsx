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
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  GraduationCap,
  KeyRound,
  Loader2,
  Settings2,
  Sparkles,
  UserCheck,
} from "lucide-react";
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
        showWebsiteCbtButton: settings.showWebsiteCbtButton,
        showWebsiteRegisterButton: settings.showWebsiteRegisterButton,
        showWebsiteStudentLoginButton: settings.showWebsiteStudentLoginButton,
        allowPublicCbtRegistration: settings.allowPublicCbtRegistration,
      });
      setSettings(saved);
      setMessage({
        type: "success",
        text: "Settings saved successfully! Website and portal will update immediately.",
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
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
          <Settings2 className="w-7 h-7 text-indigo-600" />
          Portal & Website Visibility Settings
        </h1>
        <p className="text-slate-600 mt-1">
          Configure which buttons and self-registration features appear on the
          public website and student portal login page.
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

      {/* Website Buttons Card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-600" />
            Main Website Buttons & Tickers
          </CardTitle>
          <CardDescription>
            Show or hide the action buttons that appear in the website header,
            announcement ticker, and mobile drawer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-600 text-sm py-6">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading settings…
            </div>
          ) : (
            <>
              {/* CBT Attend Button */}
              <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4">
                <div className="space-y-1 min-w-0">
                  <Label
                    htmlFor="website-cbt-toggle"
                    className="text-sm font-semibold text-slate-900 flex items-center gap-2"
                  >
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    Show "Attend CBT Test" Button on Website
                  </Label>
                  <p className="text-xs text-slate-600">
                    Controls visibility of the "Attend Test (Hall Ticket)"
                    button in the announcement bar and mobile menu.
                  </p>
                </div>
                <Switch
                  id="website-cbt-toggle"
                  checked={settings.showWebsiteCbtButton !== false}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      showWebsiteCbtButton: checked,
                    }))
                  }
                />
              </div>

              {/* CBT Register Button */}
              <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4">
                <div className="space-y-1 min-w-0">
                  <Label
                    htmlFor="website-register-toggle"
                    className="text-sm font-semibold text-slate-900 flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Show "Register Test" Button on Website
                  </Label>
                  <p className="text-xs text-slate-600">
                    Controls visibility of the "Register Test" button in the
                    announcement ticker linking to the free mock test
                    registration form.
                  </p>
                </div>
                <Switch
                  id="website-register-toggle"
                  checked={settings.showWebsiteRegisterButton !== false}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      showWebsiteRegisterButton: checked,
                    }))
                  }
                />
              </div>

              {/* Student Login Button */}
              <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4">
                <div className="space-y-1 min-w-0">
                  <Label
                    htmlFor="website-login-toggle"
                    className="text-sm font-semibold text-slate-900 flex items-center gap-2"
                  >
                    <GraduationCap className="w-4 h-4 text-brand-green" />
                    Show "Student Login" Button on Website
                  </Label>
                  <p className="text-xs text-slate-600">
                    Controls visibility of the blinking green "Student Login"
                    link in the top website header and mobile drawer.
                  </p>
                </div>
                <Switch
                  id="website-login-toggle"
                  checked={settings.showWebsiteStudentLoginButton !== false}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      showWebsiteStudentLoginButton: checked,
                    }))
                  }
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Student Portal Login Page Card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-indigo-600" />
            Student Portal Login Options
          </CardTitle>
          <CardDescription>
            Configure options available to students on the student portal login
            page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loading && (
            <>
              {/* Google Login note */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Google Login & Portal Username Login
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Enrolled students can always sign in using their Google
                  account or assigned Portal Username & Passcode.
                </p>
              </div>

              {/* Guest Login Toggle */}
              <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4">
                <div className="space-y-1 min-w-0">
                  <Label
                    htmlFor="guest-login-toggle"
                    className="text-sm font-semibold text-slate-900 flex items-center gap-2"
                  >
                    <KeyRound className="w-4 h-4 text-indigo-600" />
                    Show Guest Passcode Join Button
                  </Label>
                  <p className="text-xs text-slate-600">
                    When enabled, students see “Join test with passcode (no
                    login)” on the student login page.
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

              {/* Public Registration Acceptance Toggle */}
              <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4">
                <div className="space-y-1 min-w-0">
                  <Label
                    htmlFor="allow-public-toggle"
                    className="text-sm font-semibold text-slate-900 flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    Accept New Public CBT Registrations
                  </Label>
                  <p className="text-xs text-slate-600">
                    When enabled, students can submit the online CBT
                    registration form at /public/register.
                  </p>
                </div>
                <Switch
                  id="allow-public-toggle"
                  checked={settings.allowPublicCbtRegistration !== false}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      allowPublicCbtRegistration: checked,
                    }))
                  }
                />
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
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
                    "Save All Settings"
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
