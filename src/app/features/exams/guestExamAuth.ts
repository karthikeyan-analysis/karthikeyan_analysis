import { signInWithCustomToken } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../../../config/firebase";

type CreateGuestSessionResult = {
  customToken: string;
  uid: string;
};

export async function signInGuestWithPasscode(params: {
  name: string;
  email: string;
  testId: string;
  passcode: string;
}): Promise<void> {
  const createSession = httpsCallable<
    typeof params,
    CreateGuestSessionResult
  >(functions, "createGuestExamSession");

  const { data } = await createSession(params);
  if (!data?.customToken) {
    throw new Error("Guest session could not be started.");
  }
  await signInWithCustomToken(auth, data.customToken);
}

export function guestAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code || "";
  const message = (error as { message?: string })?.message || "";

  if (code === "functions/permission-denied" || message.includes("Incorrect passcode")) {
    return "Incorrect passcode. Please try again.";
  }
  if (code === "functions/failed-precondition") {
    return message.replace(/^FirebaseError:\s*/i, "") || "This exam is not available for guest access.";
  }
  if (code === "functions/not-found") {
    return "Exam not found.";
  }
  if (code === "functions/unavailable" || code === "functions/internal") {
    return "Guest sign-in service is unavailable. Deploy Cloud Functions or enable Anonymous sign-in in Firebase.";
  }

  return "Could not start guest session. Please try again.";
}
