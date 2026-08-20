import { useState, type MouseEvent } from "react";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { copyGuestJoinLink, guestJoinUrl, isPasscodeGuestTestConfigured } from "../../features/exams/settings";
import type { ExamTest } from "../../features/exams/types";
import { Check, Link2 } from "lucide-react";
import { cn } from "../ui/utils";

type CopyGuestLinkButtonProps = {
  test: Pick<ExamTest, "id" | "settings" | "accessPasswordHash" | "negativeMarkPerWrong" | "visibility">;
  variant?: "icon" | "outline";
  className?: string;
};

export function CopyGuestLinkButton({ test, variant = "icon", className }: CopyGuestLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  if (!isPasscodeGuestTestConfigured(test)) return null;

  const handleCopy = async (e: MouseEvent) => {
    e.stopPropagation();
    await copyGuestJoinLink(test.id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const tooltip = copied ? "Copied!" : `Copy guest link: ${guestJoinUrl(test.id)}`;

  if (variant === "outline") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("border-indigo-200 hover:bg-indigo-50", className)}
        onClick={(e) => void handleCopy(e)}
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 mr-2 text-emerald-600" />
            Copied
          </>
        ) : (
          <>
            <Link2 className="w-4 h-4 mr-2" />
            Copy guest link
          </>
        )}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("text-violet-700 hover:bg-violet-50", className)}
          onClick={(e) => void handleCopy(e)}
          aria-label="Copy guest passcode link"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Link2 className="w-4 h-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs break-all">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
