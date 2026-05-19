import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export type ExamBatchMode = "single" | "multiple";

type BatchOption = { id: string; name: string };

type Props = {
  batches: BatchOption[];
  mode: ExamBatchMode;
  batchIds: string[];
  onModeChange: (mode: ExamBatchMode) => void;
  onBatchIdsChange: (batchIds: string[]) => void;
  /** Shown under the batch controls. */
  hint?: string;
};

export function inferExamBatchMode(batchIds: string[]): ExamBatchMode {
  return batchIds.length > 1 ? "multiple" : "single";
}

export default function ExamBatchAssignmentFields({
  batches,
  mode,
  batchIds,
  onModeChange,
  onBatchIdsChange,
  hint = "Students enrolled in the selected batch(es) can see this test (unless access is restricted by student ID list).",
}: Props) {
  const singleBatchId = batchIds[0] || "";

  const setMode = (next: ExamBatchMode) => {
    onModeChange(next);
    if (next === "single") {
      const keep = batchIds[0] || batches[0]?.id;
      onBatchIdsChange(keep ? [keep] : []);
    }
  };

  const toggleMulti = (id: string, checked: boolean) => {
    const next = checked ? [...new Set([...batchIds, id])] : batchIds.filter((b) => b !== id);
    onBatchIdsChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Batch assignment</Label>
        <RadioGroup
          value={mode}
          onValueChange={(v) => setMode(v as ExamBatchMode)}
          className="flex flex-col sm:flex-row gap-3 sm:gap-6"
        >
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <RadioGroupItem value="single" id="batch-mode-single" />
            <span>Single batch</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <RadioGroupItem value="multiple" id="batch-mode-multiple" />
            <span>Multiple batches</span>
          </label>
        </RadioGroup>
        {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      </div>

      {batches.length === 0 ? (
        <p className="text-sm text-slate-500">No batches yet. Create a batch under Batch Management first.</p>
      ) : mode === "single" ? (
        <div className="space-y-2">
          <Label>Batch *</Label>
          <Select value={singleBatchId} onValueChange={(v) => onBatchIdsChange(v ? [v] : [])}>
            <SelectTrigger>
              <SelectValue placeholder="Select batch" />
            </SelectTrigger>
            <SelectContent>
              {batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Batches *</Label>
          <div className="rounded-lg border border-slate-200 p-3 max-h-48 overflow-y-auto space-y-2">
            {batches.map((batch) => {
              const checked = batchIds.includes(batch.id);
              return (
                <label
                  key={batch.id}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50 cursor-pointer"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => toggleMulti(batch.id, v === true)}
                  />
                  <span className="text-sm font-medium text-slate-800">{batch.name}</span>
                </label>
              );
            })}
          </div>
          {batchIds.length > 0 ? (
            <p className="text-xs text-slate-600">
              Selected: {batchIds.length} batch{batchIds.length === 1 ? "" : "es"}
            </p>
          ) : (
            <p className="text-xs text-amber-700">Select at least one batch.</p>
          )}
        </div>
      )}
    </div>
  );
}
