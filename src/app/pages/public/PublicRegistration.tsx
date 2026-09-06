import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../../config/firebase";
import { registerPublicStudent, usePublicAuth } from "../../context/PublicAuthContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Checkbox } from "../../components/ui/checkbox";
import { Camera } from "lucide-react";

const UG_SUBJECTS = ["Maths", "Statistics", "Economics"];
const PG_SUBJECTS = ["Maths", "Statistics", "Economics", "Others"];
const KA_YEARS = ["2026", "2025", "2024", "2023", "2022"];

const DECLARATIONS = [
  "I am willing to Practice the Free mock Test of Karthikeyan Analysis Study Circle.",
  "I am aware that I should take this CBT Test in Laptop / Desktop only.",
  "I am aware that this CBT Test will be conducted in Live mode only.",
  "All the questions in this test will be in English only.",
  "I will follow the instructions correctly and attend the test.",
  "I will attend the test discussion without fail.",
  "I will use this free test properly & will improve my potential.",
];

export default function PublicRegistration() {
  const navigate = useNavigate();
  const { login } = usePublicAuth();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "",
    fatherName: "",
    dob: "",
    phone: "",
    nativeDistrict: "",
    gender: "" as "Male" | "Female" | "",
    educationalQualifications: [] as ("UG" | "PG")[],
    subjects: [] as string[],
    isKarthikeyanStudent: "" as "Yes" | "No" | "",
    karthikeyanYear: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [declarations, setDeclarations] = useState<boolean[]>(
    new Array(DECLARATIONS.length).fill(false),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const availableSubjects = [
    ...(form.educationalQualifications.includes("UG") ? UG_SUBJECTS : []),
    ...(form.educationalQualifications.includes("PG") ? PG_SUBJECTS : []),
  ].filter((s, i, arr) => arr.indexOf(s) === i);

  const toggleQualification = (q: "UG" | "PG") => {
    setForm((prev) => {
      const has = prev.educationalQualifications.includes(q);
      const newQuals = has
        ? prev.educationalQualifications.filter((x) => x !== q)
        : [...prev.educationalQualifications, q];
      const newAvailable = [
        ...(newQuals.includes("UG") ? UG_SUBJECTS : []),
        ...(newQuals.includes("PG") ? PG_SUBJECTS : []),
      ].filter((s, i, arr) => arr.indexOf(s) === i);
      return {
        ...prev,
        educationalQualifications: newQuals,
        subjects: prev.subjects.filter((s) => newAvailable.includes(s)),
      };
    });
  };

  const toggleSubject = (s: string) => {
    setForm((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(s)
        ? prev.subjects.filter((x) => x !== s)
        : [...prev.subjects, s],
    }));
  };

  const toggleDeclaration = (i: number) => {
    setDeclarations((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const validate = (): string => {
    if (!photoFile) return "Please upload your photo.";
    if (!form.name.trim()) return "Student name is required.";
    if (!form.fatherName.trim()) return "Father's name is required.";
    if (!form.dob) return "Date of birth is required.";
    if (!form.phone.trim() || !/^\d{10}$/.test(form.phone.trim()))
      return "Enter a valid 10-digit phone number.";
    if (!form.nativeDistrict.trim()) return "Native district is required.";
    if (!form.gender) return "Please select gender.";
    if (form.educationalQualifications.length === 0) return "Please select qualification (UG / PG).";
    if (form.subjects.length === 0) return "Please select at least one subject.";
    if (!form.isKarthikeyanStudent) return "Please answer the Karthikeyan Analysis question.";
    if (form.isKarthikeyanStudent === "Yes" && !form.karthikeyanYear)
      return "Please select your batch year.";
    if (declarations.some((d) => !d)) return "Please accept all declaration points.";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const err = validate();
    if (err) { setError(err); return; }

    setSubmitting(true);
    try {
      let photoUrl = "";
      if (photoFile) {
        const safeName = `${Date.now()}_${photoFile.name.replace(/[^\w.]+/g, "_")}`;
        const fileRef = ref(storage, `publicCBTPhotos/${safeName}`);
        await uploadBytes(fileRef, photoFile);
        photoUrl = await getDownloadURL(fileRef);
      }

      const qual: "UG" | "PG" | "Both" =
        form.educationalQualifications.includes("UG") && form.educationalQualifications.includes("PG")
          ? "Both"
          : form.educationalQualifications[0]!;

      const result = await registerPublicStudent({
        name: form.name.trim(),
        fatherName: form.fatherName.trim(),
        dob: form.dob,
        phone: form.phone.trim(),
        nativeDistrict: form.nativeDistrict.trim(),
        gender: form.gender as "Male" | "Female",
        educationalQualification: qual,
        subjects: form.subjects,
        isKarthikeyanStudent: form.isKarthikeyanStudent === "Yes",
        karthikeyanYear:
          form.isKarthikeyanStudent === "Yes" ? form.karthikeyanYear : undefined,
        photoUrl: photoUrl || undefined,
      });

      const loginResult = await login(result.username, result.passcode);
      if (!loginResult.success) {
        throw new Error(
          loginResult.error ||
            "Registration succeeded but auto-login failed. Please go to Login and use your hall ticket credentials.",
        );
      }
      navigate("/public/hall-ticket", { replace: true });
    } catch (e: any) {
      setError(e?.message || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Registration form ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-1">
            Karthikeyan Analysis Study Circle
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            Free Online CBT Test – 2026
          </h1>
          <p className="text-slate-500 mt-1">Registration Form</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6 md:p-8 space-y-8">

          {/* Photo + Personal details */}
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Photo */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div
                className={`w-28 h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:border-indigo-400 transition bg-slate-50 ${photoPreview ? "border-indigo-400" : "border-red-300"}`}
                onClick={() => photoInputRef.current?.click()}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Photo" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Camera className="w-7 h-7 text-slate-400 mb-1" />
                    <span className="text-xs text-red-500 font-medium text-center px-1">Photo *<br/>(Required)</span>
                  </>
                )}
              </div>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              {photoPreview && (
                <button type="button" className="text-xs text-red-500 hover:underline" onClick={() => { setPhotoFile(null); setPhotoPreview(""); }}>Remove</button>
              )}
            </div>

            {/* Personal info */}
            <div className="flex-1 space-y-4">
              <div>
                <Label>Student Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className="mt-1" />
              </div>
              <div>
                <Label>Father's Name *</Label>
                <Input value={form.fatherName} onChange={(e) => setForm({ ...form, fatherName: e.target.value })} placeholder="Father's full name" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date of Birth *</Label>
                  <Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>Phone No *</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit number" maxLength={10} className="mt-1" />
                </div>
              </div>
            </div>
          </div>

          {/* District + Gender */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Native District *</Label>
              <Input value={form.nativeDistrict} onChange={(e) => setForm({ ...form, nativeDistrict: e.target.value })} placeholder="e.g., Chennai" className="mt-1" />
            </div>
            <div>
              <Label>Gender *</Label>
              <div className="flex gap-4 mt-2">
                {(["Male", "Female"] as const).map((g) => (
                  <label key={g} className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition ${form.gender === g ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-indigo-300"}`}>
                    <input type="radio" name="gender" value={g} checked={form.gender === g} onChange={() => setForm({ ...form, gender: g })} className="sr-only" />
                    <span className="font-medium text-sm">{g}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Educational qualification */}
          <div>
            <Label>Educational Qualification * <span className="text-xs font-normal text-slate-500">(select one or both)</span></Label>
            <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden">
              {(["UG", "PG"] as const).map((q) => {
                const qSubjects = q === "UG" ? UG_SUBJECTS : PG_SUBJECTS;
                const isSelected = form.educationalQualifications.includes(q);
                return (
                  <div key={q} className={`border-b last:border-b-0 ${isSelected ? "bg-indigo-50" : ""}`}>
                    <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleQualification(q)}
                      />
                      <span className="font-semibold text-slate-800 w-8">{q}</span>
                      <span className="text-sm text-slate-500">{qSubjects.join(" / ")}</span>
                    </label>
                    {isSelected && (
                      <div className="px-12 pb-3 flex flex-wrap gap-3">
                        {qSubjects.map((s) => (
                          <label key={s} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition ${form.subjects.includes(s) ? "border-indigo-500 bg-indigo-100 text-indigo-800 font-semibold" : "border-slate-200 hover:border-indigo-300"}`}>
                            <Checkbox checked={form.subjects.includes(s)} onCheckedChange={() => toggleSubject(s)} />
                            {s}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Karthikeyan Analysis student */}
          <div>
            <Label>Are you a student of Karthikeyan Analysis? *</Label>
            <div className="flex gap-4 mt-2">
              {(["Yes", "No"] as const).map((opt) => (
                <label key={opt} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg border-2 cursor-pointer transition font-medium ${form.isKarthikeyanStudent === opt ? "border-indigo-500 bg-indigo-50 text-indigo-800" : "border-slate-200 hover:border-indigo-300"}`}>
                  <input type="radio" name="kaStudent" value={opt} checked={form.isKarthikeyanStudent === opt} onChange={() => setForm({ ...form, isKarthikeyanStudent: opt, karthikeyanYear: "" })} className="sr-only" />
                  {opt}
                </label>
              ))}
            </div>
            {form.isKarthikeyanStudent === "Yes" && (
              <div className="mt-3 flex flex-wrap gap-2">
                {KA_YEARS.map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setForm({ ...form, karthikeyanYear: yr })}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold border-2 transition ${form.karthikeyanYear === yr ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 text-slate-600 hover:border-indigo-400"}`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Declaration */}
          <div>
            <p className="font-semibold text-slate-800 mb-3">Declaration *</p>
            <div className="space-y-3">
              {DECLARATIONS.map((text, i) => (
                <label key={i} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${declarations[i] ? "border-green-300 bg-green-50" : "border-slate-200 hover:border-indigo-200"}`}>
                  <Checkbox
                    checked={declarations[i]}
                    onCheckedChange={() => toggleDeclaration(i)}
                    className="mt-0.5 shrink-0"
                  />
                  <span className="text-sm text-slate-700">{text}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <Button type="submit" disabled={submitting} className="w-full bg-indigo-600 hover:bg-indigo-700 h-11 text-base">
            {submitting ? "Registering…" : "Register & Get Hall Ticket"}
          </Button>

          <p className="text-center text-sm text-slate-500">
            Already registered?{" "}
            <button type="button" onClick={() => navigate("/public/login")} className="text-indigo-600 font-semibold hover:underline">
              Login here
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
