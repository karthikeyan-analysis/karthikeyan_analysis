import { cn } from "../ui/utils";

type ExamQuestionImageFrameProps = {
  src: string;
  alt: string;
  questionNo?: number;
  className?: string;
  /** `viewport` caps height (admin previews). `full` shows the entire pasted screenshot. */
  display?: "viewport" | "full";
};

/**
 * Frame for pasted question screenshots.
 * Use `display="full"` in the live exam so students can scroll the complete figure.
 */
export function ExamQuestionImageFrame({
  src,
  alt,
  questionNo,
  className,
  display = "viewport",
}: ExamQuestionImageFrameProps) {
  const isFull = display === "full";

  return (
    <div
      className={cn(
        "rounded-xl border-2 border-slate-200 bg-white shadow-sm",
        isFull ? "overflow-visible" : "overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 bg-gradient-to-r from-slate-100 to-slate-50">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          Question figure
        </span>
        {questionNo != null ? (
          <span className="text-[11px] font-medium text-slate-500 tabular-nums">Q{questionNo}</span>
        ) : null}
      </div>
      <div
        className={cn(
          "flex items-center justify-center bg-slate-50",
          isFull ? "p-2 sm:p-3" : "p-2 sm:p-3 h-[min(32vh,200px)] sm:h-[min(34vh,260px)] md:h-[min(36vh,300px)] lg:h-[min(38vh,320px)]",
        )}
      >
        <img
          src={src}
          alt={alt}
          className={cn(
            "select-none object-contain object-center",
            isFull ? "w-full h-auto max-w-full" : "max-h-full max-w-full h-auto w-auto",
          )}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      </div>
    </div>
  );
}
