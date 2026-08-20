import { useState } from "react";
import { Button } from "../ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { setExamManuallyClosed } from "../../features/exams/examApi";
import { isExamManuallyClosed } from "../../features/exams/examAvailability";
import type { ExamTest } from "../../features/exams/types";
import { Loader2, Lock, LockOpen } from "lucide-react";
import { cn } from "../ui/utils";

type ExamCloseToggleButtonProps = {
  test: ExamTest;
  onUpdated: (test: ExamTest) => void;
};

export function ExamCloseToggleButton({ test, onUpdated }: ExamCloseToggleButtonProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const closed = isExamManuallyClosed(test);

  const apply = async () => {
    setSaving(true);
    try {
      const nextClosed = !closed;
      await setExamManuallyClosed(test.id, nextClosed);
      onUpdated({
        ...test,
        manuallyClosedAt: nextClosed ? new Date().toISOString() : undefined,
      });
      setOpen(false);
    } catch (e) {
      console.error(e);
      alert(closed ? "Could not reopen the test." : "Could not close the test.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          closed
            ? "text-amber-700 hover:bg-amber-50"
            : "text-slate-600 hover:bg-slate-100",
        )}
        onClick={() => setOpen(true)}
        aria-label={closed ? "Reopen test" : "Close test for new attempts"}
      >
        {closed ? <LockOpen className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{closed ? "Reopen test?" : "Close this test?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {closed ? (
                <>
                  Students and guests will be able to <strong>start new attempts</strong> again
                  (subject to publish status and passcode rules).
                </>
              ) : (
                <>
                  <strong>{test.title}</strong> will stop accepting new starts. Students already in
                  the exam can finish until their timer ends. Results and analytics stay available.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={closed ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-800 hover:bg-slate-900"}
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                void apply();
              }}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : closed ? (
                "Reopen test"
              ) : (
                "Close test"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
