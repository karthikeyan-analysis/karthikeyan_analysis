import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  formatMarksLabel,
  QUESTION_MARK_OPTIONS,
  type QuestionMarkOption,
} from "../../features/exams/examMarks";

type QuestionMarksSelectProps = {
  value: QuestionMarkOption;
  onChange: (value: QuestionMarkOption) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
  id?: string;
};

export function QuestionMarksSelect({
  value,
  onChange,
  label = "Default marks per question",
  hint,
  disabled,
  id,
}: QuestionMarksSelectProps) {
  return (
    <div className="space-y-2">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <Select
        value={formatMarksLabel(value)}
        onValueChange={(v) => onChange(parseFloat(v) as QuestionMarkOption)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="w-full max-w-[200px]">
          <SelectValue placeholder="Marks" />
        </SelectTrigger>
        <SelectContent>
          {QUESTION_MARK_OPTIONS.map((m) => (
            <SelectItem key={m} value={formatMarksLabel(m)}>
              {formatMarksLabel(m)} mark{ m === 1 ? "" : "s"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
