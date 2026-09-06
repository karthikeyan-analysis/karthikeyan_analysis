import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../config/firebase";

export const PORTAL_LOGIN_SETTINGS_DOC = "portalLogin";

export type PortalLoginSettings = {
  /** When false, the "Join test with passcode" button is hidden on student login. */
  showGuestLoginButton: boolean;
  updatedAt?: string;
};

export const DEFAULT_PORTAL_LOGIN_SETTINGS: PortalLoginSettings = {
  showGuestLoginButton: true,
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
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
    };
  } catch (error) {
    console.warn("Could not load portal login settings; using defaults.", error);
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
