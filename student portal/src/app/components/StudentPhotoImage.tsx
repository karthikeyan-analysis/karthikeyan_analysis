import React, { useEffect, useMemo, useState } from "react";
import { getStudentPhotoDisplayCandidates } from "../features/students/studentPhotoUrl";
import { cn } from "./ui/utils";

type Props = {
  photoURL?: string | null;
  alt?: string;
  className?: string;
  imgClassName?: string;
  fallback?: React.ReactNode;
};

/** Profile image with Google Drive / external URL fallbacks when the first src fails. */
export default function StudentPhotoImage({
  photoURL,
  alt = "",
  className,
  imgClassName,
  fallback = null,
}: Props) {
  const candidates = useMemo(() => getStudentPhotoDisplayCandidates(photoURL), [photoURL]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [photoURL]);

  const src = candidates[index];
  if (!src) return <>{fallback}</>;

  return (
    <img
      src={src}
      alt={alt}
      className={cn(className, imgClassName)}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => {
        setIndex((i) => (i < candidates.length - 1 ? i + 1 : i));
      }}
    />
  );
}
