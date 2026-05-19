import { cn } from "../ui/utils";

type ExamQuestionImageFrameProps = {
  src: string;
  alt: string;
  questionNo?: number;
  className?: string;
};

/**
 * Fixed viewport for pasted question screenshots — image scales with object-contain
 * so the full figure stays visible on mobile and desktop.
 */
export function ExamQuestionImageFrame({
  src,
  alt,
  questionNo,
  className,
}: ExamQuestionImageFrameProps) {
  return (
    <div
      className={cn(
        "rounded-xl border-2 border-slate-200 bg-white overflow-hidden shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 bg-slate-100">
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
          "p-2 sm:p-3",
          "h-[min(32vh,200px)] sm:h-[min(34vh,260px)] md:h-[min(36vh,300px)] lg:h-[min(38vh,320px)]",
        )}
      >
        <img
          src={src}
          alt={alt}
          className="max-h-full max-w-full h-auto w-auto object-contain object-center select-none"
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      </div>
    </div>
  );
}
