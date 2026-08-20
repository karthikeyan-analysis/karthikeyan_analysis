import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "../../context/AuthContext";
import bannerImage from "../../../banner.jpeg";
import { Button } from "../../components/ui/button";
import {
  getAttempt,
  getExamTest,
  listPrivateQuestions,
  listPublicQuestions,
} from "../../features/exams/examApi";
import { useStudentPhoto } from "../../features/students/useStudentPhoto";
import type { ExamQuestionPrivate } from "../../features/exams/types";
import { buildResponseSheetHtml } from "../../features/exams/responseSheetPdf";
import { ArrowLeft, Loader2, Printer } from "lucide-react";

export default function ResponseSheetPage() {
  const { id } = useParams();
  const testId = id || "";
  const { user } = useAuth();
  const navigate = useNavigate();
  const { photoURL, displaySrc: studentPhotoSrc } = useStudentPhoto();

  const [loading, setLoading] = useState(true);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!testId || !user?.id) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [test, attempt, questions] = await Promise.all([
          getExamTest(testId),
          getAttempt(testId, user.id),
          listPublicQuestions(testId),
        ]);

        if (cancelled) return;

        if (!test || !attempt) {
          setError("Could not find exam data.");
          setLoading(false);
          return;
        }

        // Mirror the canShowAnswers logic from ExamResult
        let keys: ExamQuestionPrivate[] | null = null;
        const shouldShowAnswers = (() => {
          if (attempt.status !== "submitted") return false;
          if (test.showAnswersAfter === "never") return false;
          if (test.showAnswersAfter === "immediate") return true;
          const hardEndAtMs = attempt.hardEndAt
            ? new Date(attempt.hardEndAt).getTime()
            : null;
          if (hardEndAtMs != null) return Date.now() >= hardEndAtMs;
          return true;
        })();

        if (shouldShowAnswers) {
          try {
            keys = await listPrivateQuestions(testId);
          } catch {}
        }

        if (cancelled) return;

        const studentName =
          attempt.participantName?.trim() ||
          user.name?.trim() ||
          attempt.participantEmail?.trim() ||
          "Student";
        const studentId = user.isGuestExamParticipant
          ? user.email?.trim() || "Guest"
          : user.studentId?.trim() || user.studentRecordId?.trim() || "-";

        // Vite serves assets as absolute paths like /assets/banner-HASH.jpeg.
        // Inside a srcdoc iframe the base URL is "about:srcdoc", which differs
        // across browsers. Making the URL explicitly absolute is the safe approach.
        const absoluteBanner = bannerImage.startsWith("/")
          ? `${window.location.origin}${bannerImage}`
          : bannerImage;

        const sheetHtml = buildResponseSheetHtml({
          test,
          attempt,
          questions,
          keys,
          bannerImage: absoluteBanner,
          photoURL: studentPhotoSrc || photoURL,
          participant: {
            name: studentName,
            email: user.email || attempt.participantEmail || "",
            studentId,
            studentRecordId: user.studentRecordId || attempt.studentRecordId || "",
            isGuest:
              user.isGuestExamParticipant === true || attempt.isGuest === true,
            photoURL: studentPhotoSrc || photoURL,
          },
          generatedBy: "student",
        });

        setHtml(sheetHtml);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Failed to load response sheet. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [testId, user?.id, studentPhotoSrc, photoURL]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Control bar — hidden when the user triggers the browser print dialog */}
      <div className="flex items-center gap-3 bg-indigo-600 px-4 py-2 text-white shrink-0 print:hidden">
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-indigo-700"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <span className="flex-1 text-sm font-semibold truncate">
          Response Sheet
        </span>
        {!loading && html && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => iframeRef.current?.contentWindow?.print()}
          >
            <Printer className="w-4 h-4 mr-2" />
            Print / Save as PDF
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center gap-2 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          Loading response sheet…
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-red-600 text-sm px-4 text-center">
          {error}
        </div>
      ) : html ? (
        // srcdoc iframe: same-origin as the app so all Firebase Storage image URLs
        // and other resources load exactly as they do on the main result page.
        <iframe
          ref={iframeRef}
          srcDoc={html}
          className="flex-1 w-full border-0"
          title="Response Sheet"
        />
      ) : null}
    </div>
  );
}
