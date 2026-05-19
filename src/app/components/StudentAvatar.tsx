import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { getStudentPhotoDisplayCandidates } from "../features/students/studentPhotoUrl";
import { cn } from "./ui/utils";

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
}

type Size = "sm" | "md" | "lg" | "xl";

const sizeClass: Record<Size, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-lg",
};

export default function StudentAvatar({
  name,
  photoURL,
  className,
  size = "md",
}: {
  name: string;
  photoURL?: string | null;
  className?: string;
  size?: Size;
}) {
  const label = name.trim() || "Student";
  const candidates = useMemo(() => getStudentPhotoDisplayCandidates(photoURL), [photoURL]);
  const [srcIndex, setSrcIndex] = useState(0);

  useEffect(() => {
    setSrcIndex(0);
  }, [photoURL]);

  const displaySrc = candidates[srcIndex];

  return (
    <Avatar className={cn(sizeClass[size], className)}>
      {displaySrc ? (
        <AvatarImage
          src={displaySrc}
          alt=""
          className="object-cover"
          referrerPolicy="no-referrer"
          onLoadingStatusChange={(status) => {
            if (status === "error" && srcIndex < candidates.length - 1) {
              setSrcIndex((i) => i + 1);
            }
          }}
        />
      ) : null}
      <AvatarFallback className="bg-indigo-600 text-white font-semibold">
        {initialsFromName(label)}
      </AvatarFallback>
    </Avatar>
  );
}
