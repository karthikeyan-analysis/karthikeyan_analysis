import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Copy, Eye, EyeOff, KeyRound, Plus, Trash2, UserPlus, Users } from "lucide-react";
import {
  createCoHostAccount,
  deleteCoHostAccount,
  resetCoHostAccountPassword,
  subscribeToCoHosts,
  type AdminProfile,
} from "../../features/liveClasses/adminDirectory";

interface SharedCredentials {
  name: string;
  email: string;
  password: string;
  title: string;
}

function randomPassword(length = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (const n of arr) out += chars[n % chars.length];
  return out;
}

export default function CoHostManagement() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => randomPassword());
  const [showPassword, setShowPassword] = useState(true);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdminProfile | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const [shared, setShared] = useState<SharedCredentials | null>(null);

  useEffect(() => {
    const unsub = subscribeToCoHosts((list) => {
      setRows(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (user?.adminKind === "cohost") {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-slate-600">
          Co-host accounts cannot manage other co-hosts.
        </CardContent>
      </Card>
    );
  }

  const openCreate = () => {
    setName("");
    setEmail("");
    setPassword(randomPassword());
    setShowPassword(true);
    setCreateOpen(true);
  };

  const create = async () => {
    if (!name.trim()) return alert("Please enter the co-host name.");
    if (!email.trim() || !email.includes("@")) return alert("Please enter a valid email.");
    if (password.length < 6) return alert("Password must be at least 6 characters.");

    setCreating(true);
    try {
      const result = await createCoHostAccount({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      setCreateOpen(false);
      setShared({
        name: result.name,
        email: result.email,
        password: result.password,
        title: "Co-host created — share these login details",
      });
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.message?.replace(/^Firebase:\s*/i, "").replace(/\s*\(.*\)\s*$/, "").trim() ||
        "Could not create co-host.";
      alert(msg);
    } finally {
      setCreating(false);
    }
  };

  const remove = async (row: AdminProfile) => {
    if (!confirm(`Delete co-host "${row.name}" (${row.email})? They will no longer be able to log in.`)) {
      return;
    }
    try {
      await deleteCoHostAccount(row.uid);
    } catch (e: any) {
      console.error(e);
      alert(e?.message?.replace(/^Firebase:\s*/i, "").replace(/\s*\(.*\)\s*$/, "").trim() || "Delete failed.");
    }
  };

  const openReset = (row: AdminProfile) => {
    setResetTarget(row);
    setResetPassword(randomPassword());
    setResetOpen(true);
  };

  const doReset = async () => {
    if (!resetTarget) return;
    if (resetPassword.length < 6) return alert("Password must be at least 6 characters.");
    setResetting(true);
    try {
      const result = await resetCoHostAccountPassword(resetTarget.uid, resetPassword);
      setResetOpen(false);
      setShared({
        name: result.name,
        email: result.email,
        password: result.password,
        title: "Password reset — share the new login details",
      });
    } catch (e: any) {
      console.error(e);
      alert(e?.message?.replace(/^Firebase:\s*/i, "").replace(/\s*\(.*\)\s*$/, "").trim() || "Reset failed.");
    } finally {
      setResetting(false);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied.");
    } catch {
      alert("Could not copy — please select and copy manually.");
    }
  };

  const loginUrl =
    typeof window !== "undefined" ? `${window.location.origin}/admin/login` : "/admin/login";

  return (
    <div className="space-y-6">
      <Card className="border-slate-200">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-indigo-600" />
              Co-Host Management
            </CardTitle>
            <CardDescription className="mt-1.5">
              Create co-host logins (email + password), share credentials with teachers, then assign
              them as Host or Co-Host when creating a Live Class. They sign in at{" "}
              <span className="font-medium text-slate-700">{loginUrl}</span>.
            </CardDescription>
          </div>
          <Button className="bg-indigo-600 hover:bg-indigo-700 shrink-0" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            New Co-Host
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
              <Users className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm text-slate-600">No co-hosts yet.</p>
              <p className="mt-1 text-xs text-slate-500">
                Create one to get email/password credentials you can share with a teacher.
              </p>
              <Button className="mt-4 bg-indigo-600 hover:bg-indigo-700" onClick={openCreate}>
                <Plus className="mr-1.5 h-4 w-4" />
                Create first co-host
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email (login)</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.uid}>
                      <TableCell className="font-medium text-slate-800">{row.name}</TableCell>
                      <TableCell className="text-sm text-slate-600">{row.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">Co-Host</Badge>
                      </TableCell>
                      <TableCell className="space-x-2 whitespace-nowrap text-right">
                        <Button size="sm" variant="outline" onClick={() => openReset(row)}>
                          <KeyRound className="mr-1 h-3.5 w-3.5" />
                          Reset password
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => void remove(row)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-slate-50/60">
        <CardHeader>
          <CardTitle className="text-base">How to use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <p>1. Create a co-host and copy the email + password from the share dialog.</p>
          <p>2. Send those credentials to the teacher (WhatsApp/email).</p>
          <p>
            3. They open <strong>Admin Login</strong> ({loginUrl}) and sign in with that email/password.
          </p>
          <p>
            4. When you create a Live Class, tick them under <strong>Host</strong> or{" "}
            <strong>Co-Host</strong> — they can then start/join the room with the same controls.
          </p>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Co-Host</DialogTitle>
            <DialogDescription>
              These credentials will be shown once so you can share them with the teacher.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Teacher Ramesh" />
            </div>
            <div className="space-y-2">
              <Label>Login email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button type="button" variant="outline" onClick={() => setPassword(randomPassword())}>
                  Generate
                </Button>
              </div>
              <p className="text-xs text-slate-500">Minimum 6 characters. Share this with the co-host.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" disabled={creating} onClick={() => void create()}>
              {creating ? "Creating…" : "Create & show credentials"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              New password for {resetTarget?.name} ({resetTarget?.email}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>New password</Label>
            <div className="flex gap-2">
              <Input value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
              <Button type="button" variant="outline" onClick={() => setResetPassword(randomPassword())}>
                Generate
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" disabled={resetting} onClick={() => void doReset()}>
              {resetting ? "Saving…" : "Reset & show credentials"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share credentials */}
      <Dialog open={!!shared} onOpenChange={(open) => !open && setShared(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{shared?.title || "Credentials"}</DialogTitle>
            <DialogDescription>
              Copy and share these with the co-host. The password is not stored in plain text after
              this — use Reset password if they forget it.
            </DialogDescription>
          </DialogHeader>
          {shared ? (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-500">Name</p>
                  <p className="font-medium text-slate-900">{shared.name}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Login email</p>
                  <p className="truncate font-medium text-slate-900">{shared.email}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => void copyText(shared.email)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Password</p>
                  <p className="font-mono font-medium text-slate-900">{shared.password}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => void copyText(shared.password)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Login page</p>
                  <p className="truncate text-xs text-slate-700">{loginUrl}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void copyText(
                      `Login: ${loginUrl}\nEmail: ${shared.email}\nPassword: ${shared.password}`,
                    )
                  }
                >
                  Copy all
                </Button>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setShared(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
