import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../config/firebase";

export const PORTAL_LOGIN_SETTINGS_DOC = "portalLogin";

export type PortalLoginSettings = {
  /** When false, the "Join test with passcode" button is hidden on student login. */
  showGuestLoginButton: boolean;
  /** When false, the "Attend CBT Test" button on the main website is hidden. */
  showWebsiteCbtButton?: boolean;
  /** When false, the "Register Test" button on the main website is hidden. */
  showWebsiteRegisterButton?: boolean;
  /** When false, the "Student Login" button on the main website is hidden. */
  showWebsiteStudentLoginButton?: boolean;
  /** When false, public students cannot self-register for CBT tests. */
  allowPublicCbtRegistration?: boolean;
  updatedAt?: string;
};

export const DEFAULT_PORTAL_LOGIN_SETTINGS: PortalLoginSettings = {
  showGuestLoginButton: true,
  showWebsiteCbtButton: true,
  showWebsiteRegisterButton: true,
  showWebsiteStudentLoginButton: true,
  allowPublicCbtRegistration: true,
};

function portalLoginSettingsRef() {
  return doc(db, "siteSettings", PORTAL_LOGIN_SETTINGS_DOC);
}

export async function getPortalLoginSettings(): Promise<PortalLoginSettings> {
  try {
    const snap = await getDoc(portalLoginSettingsRef());
    if (!snap.exists()) return { ...DEFAULT_PORTAL_LOGIN_SETTINGS };
    const data = snap.data() as Partial<PortalLoginSettings>;
    return {
      showGuestLoginButton:
        typeof data.showGuestLoginButton === "boolean"
          ? data.showGuestLoginButton
          : DEFAULT_PORTAL_LOGIN_SETTINGS.showGuestLoginButton,
      showWebsiteCbtButton:
        typeof data.showWebsiteCbtButton === "boolean"
          ? data.showWebsiteCbtButton
          : DEFAULT_PORTAL_LOGIN_SETTINGS.showWebsiteCbtButton,
      showWebsiteRegisterButton:
        typeof data.showWebsiteRegisterButton === "boolean"
          ? data.showWebsiteRegisterButton
          : DEFAULT_PORTAL_LOGIN_SETTINGS.showWebsiteRegisterButton,
      showWebsiteStudentLoginButton:
        typeof data.showWebsiteStudentLoginButton === "boolean"
          ? data.showWebsiteStudentLoginButton
          : DEFAULT_PORTAL_LOGIN_SETTINGS.showWebsiteStudentLoginButton,
      allowPublicCbtRegistration:
        typeof data.allowPublicCbtRegistration === "boolean"
          ? data.allowPublicCbtRegistration
          : DEFAULT_PORTAL_LOGIN_SETTINGS.allowPublicCbtRegistration,
      updatedAt:
        typeof data.updatedAt === "string" ? data.updatedAt : undefined,
    };
  } catch (error) {
    console.warn(
      "Could not load portal login settings; using defaults.",
      error,
    );
    return { ...DEFAULT_PORTAL_LOGIN_SETTINGS };
  }
}

export async function savePortalLoginSettings(
  updates: Partial<PortalLoginSettings>,
): Promise<PortalLoginSettings> {
  const current = await getPortalLoginSettings();
  const next: PortalLoginSettings = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await setDoc(portalLoginSettingsRef(), next, { merge: true });
  return next;
}
