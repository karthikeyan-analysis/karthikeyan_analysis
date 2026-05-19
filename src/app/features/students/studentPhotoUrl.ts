/**
 * Normalize and resolve student profile photo URLs for display.
 * Supports Firebase Storage download URLs, direct image links, and Google Drive share links.
 */

/** Extract Google Drive file id from common share / open URL shapes. */
export function extractGoogleDriveFileId(url: string): string | null {
  const s = url.trim();
  if (!s) return null;

  const filePath = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (filePath?.[1]) return filePath[1];

  const ucPath = s.match(/\/uc\?[^#]*\bid=([a-zA-Z0-9_-]+)/);
  if (ucPath?.[1]) return ucPath[1];

  try {
    const parsed = new URL(s);
    const idParam = parsed.searchParams.get("id");
    if (idParam && /^[a-zA-Z0-9_-]+$/.test(idParam)) return idParam;
  } catch {
    // not a valid URL
  }

  const idQuery = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idQuery?.[1]) return idQuery[1];

  return null;
}

export function isGoogleDrivePhotoUrl(url: string): boolean {
  return !!extractGoogleDriveFileId(url);
}

export function looksLikePhotoUrl(value: string): boolean {
  const s = value.trim();
  if (!s) return false;
  if (extractGoogleDriveFileId(s)) return true;
  if (/^https?:\/\//i.test(s)) {
    if (/firebasestorage\.googleapis\.com/i.test(s)) return true;
    if (/googleusercontent\.com/i.test(s)) return true;
    if (/\.(jpe?g|png|gif|webp)(\?|#|$)/i.test(s)) return true;
    if (/drive\.google\.com|docs\.google\.com/i.test(s)) return true;
    return s.length > 15;
  }
  return false;
}

/**
 * Canonical URL stored in Firestore. Drive links are normalized to a direct-view URL.
 */
export function normalizeStudentPhotoUrl(raw: string | undefined | null): string | undefined {
  const s = String(raw ?? "").trim();
  if (!s) return undefined;

  const driveId = extractGoogleDriveFileId(s);
  if (driveId) {
    return `https://drive.google.com/uc?export=view&id=${driveId}`;
  }

  if (/^https?:\/\//i.test(s)) return s;
  return undefined;
}

/** Google Drive thumbnail — loads more reliably in &lt;img&gt; than uc?export=view. */
export function googleDriveThumbnailUrl(fileId: string, size = 400): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

/** URL suitable for &lt;img src&gt;. Drive links use the thumbnail endpoint for reliable previews. */
export function resolveStudentPhotoDisplayUrl(photoURL?: string | null): string | undefined {
  const candidates = getStudentPhotoDisplayCandidates(photoURL);
  return candidates[0];
}

/** Ordered URLs to try when embedding a profile photo (thumbnail first, then direct view). */
export function getStudentPhotoDisplayCandidates(photoURL?: string | null): string[] {
  if (!photoURL?.trim()) return [];
  const raw = photoURL.trim();
  const driveId = extractGoogleDriveFileId(raw);
  if (driveId) {
    return [
      googleDriveThumbnailUrl(driveId, 400),
      `https://drive.google.com/uc?export=view&id=${driveId}`,
      `https://drive.google.com/uc?export=download&id=${driveId}`,
    ];
  }
  const normalized = normalizeStudentPhotoUrl(raw);
  const primary = normalized ?? raw;
  return primary === raw ? [primary] : [primary, raw];
}

/** First photo-like URL in a list of cell values (import row scan). */
export function findPhotoUrlInValues(values: unknown[]): string | undefined {
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (looksLikePhotoUrl(s)) return normalizeStudentPhotoUrl(s) ?? s;
  }
  return undefined;
}

type ExcelCellLike = {
  v?: unknown;
  l?: { Target?: string };
  f?: string;
};

/** Read URL from an Excel cell value, hyperlink, or HYPERLINK() formula. */
export function extractUrlFromExcelCell(cell: ExcelCellLike | undefined): string | undefined {
  if (!cell) return undefined;
  if (cell.l?.Target && /^https?:\/\//i.test(cell.l.Target)) return cell.l.Target.trim();
  if (typeof cell.v === "string" && /^https?:\/\//i.test(cell.v)) return cell.v.trim();
  if (cell.f && /HYPERLINK/i.test(cell.f)) {
    const m = cell.f.match(/HYPERLINK\s*\(\s*"((?:[^"\\]|\\.)*)"/i);
    if (m?.[1]) return m[1].replace(/\\"/g, '"').trim();
  }
  return undefined;
}
