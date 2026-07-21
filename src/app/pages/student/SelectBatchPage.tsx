import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { AlertCircle, Layers3, Loader2 } from "lucide-react";

export default function SelectBatchPage() {
  const { user, setActiveBatch } = useAuth();
  const { batches } = useData();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const enrolledBatches = useMemo(() => {
    const ids = user?.batchIds?.length
      ? user.batchIds
      : user?.batchId
        ? [user.batchId]
        : [];
    return ids
      .map((id) => batches.find((b) => b.id === id) || { id, name: "Unknown batch" })
      .filter(Boolean);
  }, [batches, user?.batchId, user?.batchIds]);

  const handleSelect = async (batchId: string) => {
    setError("");
    setSaving(true);
    try {
      await setActiveBatch(batchId);
      navigate("/student", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Could not switch batch. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 p-4">
      <Card className="w-full max-w-lg shadow-xl border-indigo-100">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
            <Layers3 className="w-6 h-6 text-indigo-700" />
          </div>
          <CardTitle className="text-2xl">Choose your batch</CardTitle>
          <CardDescription>
            Hi {user.name || "Student"} — you are enrolled in more than one batch.
            Pick which batch to use now. You can switch later from the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          ) : null}

          {enrolledBatches.length === 0 ? (
            <p className="text-sm text-slate-600 text-center py-6">
              No batches are assigned to your account. Contact your admin.
            </p>
          ) : (
            enrolledBatches.map((batch) => (
              <Button
                key={batch.id}
                type="button"
                variant="outline"
                className="w-full h-auto py-4 justify-start text-left border-slate-200 hover:border-indigo-300 hover:bg-indigo-50"
                disabled={saving}
                onClick={() => void handleSelect(batch.id)}
              >
                <div>
                  <div className="font-semibold text-slate-900">{batch.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Use media and tests for this batch</div>
                </div>
              </Button>
            ))
          )}

          {saving ? (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-600 pt-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Switching batch…
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
