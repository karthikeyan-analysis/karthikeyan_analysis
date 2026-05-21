import { isExamManuallyClosed } from "./examAvailability";
import type { ExamAccessMode, ExamAdvancedSettings, ExamTest } from "./types";

export const DEFAULT_EXAM_SETTINGS: Required<ExamAdvancedSettings> = {
  colorScheme: "karthikeyan",
  interfaceLanguage: "en",
  paginationMode: "one_per_page",
  randomizeQuestionOrder: false,
  allowBlankAnswers: false,
  negativeMarkingEnabled: false,
  conclusionText: "",
  showPassFailMessage: false,
  reviewShowScore: true,
  reviewShowOutline: false,
  reviewShowCorrectness: true,
  reviewShowCorrectAnswer: false,
  reviewShowExplanation: false,
  accessMode: "both",
  passcodeHint: "",
  allowedIdentifiers: [],
  allowedEmails: [],
  identityPrompt: "Enter your name",
  disableRightClick: true,
  disableCopyPaste: true,
  disableTranslate: true,
  disableAutocomplete: true,
  disableSpellcheck: true,
  disablePrinting: true,
  notifyOnSubmitMode: "account_default",
  notificationEmails: [],
};

export function applySystemExamSettingLocks(
  settings: Required<ExamAdvancedSettings>,
): Required<ExamAdvancedSettings> {
  return {
    ...settings,
    interfaceLanguage: "en",
    disableRightClick: true,
    disableCopyPaste: true,
    disableTranslate: true,
    disableAutocomplete: true,
    disableSpellcheck: true,
    disablePrinting: true,
    showPassFailMessage: false,
    reviewShowScore: true,
    reviewShowOutline: false,
    reviewShowCorrectness: true,
    reviewShowCorrectAnswer: false,
    reviewShowExplanation: false,
  };
}

export type NormalizedExamAccessMode = "batch" | "passcode" | "both";

/** Map stored / legacy accessMode values to the three supported modes. */
export function normalizeAccessMode(mode?: ExamAccessMode): NormalizedExamAccessMode {
  if (mode === "both") return "both";
  if (mode === "passcode") return "passcode";
  if (mode === "batch") return "batch";
  // Legacy: "anyone" and ID lists meant batch-scoped access without guest passcode.
  if (mode === "anyone" || mode === "identifier_list" || mode === "email_list") return "batch";
  return "batch";
}

export function getEffectiveExamSettings(
  test: Pick<ExamTest, "settings" | "accessPasswordHash" | "negativeMarkPerWrong" | "visibility">,
): Required<ExamAdvancedSettings> {
  const merged = applySystemExamSettingLocks({
    ...DEFAULT_EXAM_SETTINGS,
    ...(test.settings || {}),
  });

  merged.accessMode = normalizeAccessMode(merged.accessMode);

  if ((test.negativeMarkPerWrong || 0) > 0) {
    merged.negativeMarkingEnabled = true;
  }

  return merged;
}

/** Enrolled students in the selected batch(es) can see and take this test from their schedule. */
export function enrolledStudentsCanAccessTest(
  test: Pick<ExamTest, "settings" | "accessPasswordHash" | "negativeMarkPerWrong" | "visibility">,
): boolean {
  const mode = normalizeAccessMode(getEffectiveExamSettings(test).accessMode);
  if (mode === "batch" || mode === "both" || mode === "passcode") return true;
  // Legacy SELECTIVE roster (old ID-list tests) — still allow if student is listed.
  if (test.visibility === "SELECTIVE") return true;
  return false;
}

export function accessModeUsesPasscode(
  test: Pick<ExamTest, "settings" | "accessPasswordHash" | "negativeMarkPerWrong" | "visibility">,
): boolean {
  const mode = normalizeAccessMode(getEffectiveExamSettings(test).accessMode);
  return mode === "passcode" || mode === "both";
}

export function parseCsvList(input: string) {
  return input
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Test has passcode guest access configured (admin UI / link sharing). */
export function isPasscodeGuestTestConfigured(
  test: Pick<ExamTest, "settings" | "accessPasswordHash" | "negativeMarkPerWrong" | "visibility">,
): boolean {
  return accessModeUsesPasscode(test) && Boolean(test.accessPasswordHash);
}

/** Passcode tests that allow unenrolled guests (name + email collected at join). */
export function allowsPasscodeGuestAccess(
  test: Pick<ExamTest, "settings" | "accessPasswordHash" | "negativeMarkPerWrong" | "visibility" | "status" | "manuallyClosedAt">,
): boolean {
  if (test.status && test.status !== "published") return false;
  if (isExamManuallyClosed(test)) return false;
  return isPasscodeGuestTestConfigured(test);
}

export function guestJoinUrl(testId: string, origin = typeof window !== "undefined" ? window.location.origin : "") {
  const base = origin.replace(/\/$/, "");
  return `${base}/student/join-test/${testId}`;
}

export async function copyGuestJoinLink(testId: string): Promise<void> {
  const url = guestJoinUrl(testId);
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const input = document.createElement("input");
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
  }
}

