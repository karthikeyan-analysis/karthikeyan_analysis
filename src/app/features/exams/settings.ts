import type { ExamAdvancedSettings, ExamTest } from "./types";

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
  accessMode: "anyone",
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

export function getEffectiveExamSettings(
  test: Pick<ExamTest, "settings" | "accessPasswordHash" | "negativeMarkPerWrong" | "visibility">,
): Required<ExamAdvancedSettings> {
  const merged = applySystemExamSettingLocks({
    ...DEFAULT_EXAM_SETTINGS,
    ...(test.settings || {}),
  });

  if (test.accessPasswordHash && merged.accessMode === "anyone") {
    merged.accessMode = "passcode";
  }
  if (test.visibility === "SELECTIVE" && merged.accessMode === "anyone") {
    merged.accessMode = "identifier_list";
  }
  if ((test.negativeMarkPerWrong || 0) > 0) {
    merged.negativeMarkingEnabled = true;
  }

  return merged;
}

export function parseCsvList(input: string) {
  return input
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

