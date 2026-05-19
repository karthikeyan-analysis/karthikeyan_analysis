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

/** URL suitable for &lt;img src&gt; (same as stored form for our normalizers). */
export function resolveStudentPhotoDisplayUrl(photoURL?: string | null): string | undefined {
  if (!photoURL?.trim()) return undefined;
  return normalizeStudentPhotoUrl(photoURL) ?? photoURL.trim();
}
