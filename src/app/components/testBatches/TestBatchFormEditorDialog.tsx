import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { useAuth } from "../../context/AuthContext";
import type { Batch } from "../../context/DataContext";
import {
  getTestBatchFormConfig,
  upsertTestBatchFormConfig,
} from "../../features/testBatches/testBatchFormApi";

interface HeaderState {
  batchName: string;
  courseSubjectName: string;
  duration: string;
}

interface FooterState {
  instructions: string;
  termsAndConditions: string;
}

export default function TestBatchFormEditorDialog({
  batch,
  open,
  onOpenChange,
}: {
  batch: Batch;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [header, setHeader] = useState<HeaderState>({
    batchName: "",
    courseSubjectName: "",
    duration: "",
  });
  const [footer, setFooter] = useState<FooterState>({
    instructions: "",
    termsAndConditions: "",
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const cfg = await getTestBatchFormConfig(batch.id);
        if (cancelled) return;
        if (cfg) {
          setHeader(cfg.header);
          setFooter(cfg.footer);
        } else {
          setHeader({
            batchName: batch.name || "",
            courseSubjectName: (batch.subjects || []).join(", "),
            duration: batch.schedule || "",
          });
          setFooter({ instructions: "", termsAndConditions: "" });
        }
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
  }, [open, batch]);

  const save = async () => {
    if (!header.batchName.trim()) {
      alert("Batch name is required.");
      return;
    }
    setSaving(true);
    try {
      await upsertTestBatchFormConfig(
        batch.id,
        {
          header: {
            batchName: header.batchName.trim(),
            courseSubjectName: header.courseSubjectName.trim(),
            duration: header.duration.trim(),
          },
          footer: {
            instructions: footer.instructions.trim(),
            termsAndConditions: footer.termsAndConditions.trim(),
          },
        },
        user?.id || "admin",
      );
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      alert("Could not save application form settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize Application Form — {batch.name}</DialogTitle>
          <DialogDescription>
            These header and footer settings apply only to this batch's
            registration form. Other batches are unaffected.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500">
            Loading current settings…
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-800">
                Header
              </div>
              <div className="space-y-2">
                <Label>Batch Name</Label>
                <Input
                  value={header.batchName}
                  onChange={(e) =>
                    setHeader((h) => ({ ...h, batchName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Course / Subject Name</Label>
                <Input
                  value={header.courseSubjectName}
                  onChange={(e) =>
                    setHeader((h) => ({
                      ...h,
                      courseSubjectName: e.target.value,
                    }))
                  }
                  placeholder="e.g. Mathematics Foundation Course"
                />
              </div>
              <div className="space-y-2">
                <Label>Duration</Label>
                <Input
                  value={header.duration}
                  onChange={(e) =>
                    setHeader((h) => ({ ...h, duration: e.target.value }))
                  }
                  placeholder="e.g. 3 months"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-800">
                Footer / Policies
              </div>
              <div className="space-y-2">
                <Label>Instructions</Label>
                <Textarea
                  rows={4}
                  value={footer.instructions}
                  onChange={(e) =>
                    setFooter((f) => ({ ...f, instructions: e.target.value }))
                  }
                  placeholder="Instructions specific to this batch's registration…"
                />
              </div>
              <div className="space-y-2">
                <Label>Terms &amp; Conditions</Label>
                <Textarea
                  rows={6}
                  value={footer.termsAndConditions}
                  onChange={(e) =>
                    setFooter((f) => ({
                      ...f,
                      termsAndConditions: e.target.value,
                    }))
                  }
                  placeholder="Terms and conditions specific to this test batch…"
                />
              </div>
              <p className="text-xs text-slate-500">
                Leave blank to use the default terms shown to every batch.
              </p>
            </div>

            <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-xs text-indigo-900">
              <span className="font-semibold">Preview:</span>{" "}
              {header.batchName || batch.name} • {" "}
              {header.courseSubjectName || "Course / Subject"} • {" "}
              {header.duration || "Duration"}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
