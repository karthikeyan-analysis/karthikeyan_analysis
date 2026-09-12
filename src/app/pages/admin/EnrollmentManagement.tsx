import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import {
  Copy,
  Download,
  Trash2,
  RefreshCw,
  Plus,
  FileDown,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  KeyRound,
  ShieldCheck,
  Building2,
  Calendar,
  Save,
  CheckCheck,
  Users,
  Search,
  Pencil,
  FileSpreadsheet,
  AlertCircle,
  Filter,
  User,
} from "lucide-react";
import type {
  BatchEnrollmentConfig,
  EnrollmentForm,
  ScheduledEnrollmentForm,
} from "../../features/enrollment/enrollment-types";
import {
  getAllEnrollmentForms,
  approveStudentEnrollment,
  rejectStudentEnrollment,
  deleteEnrollmentForm,
  getDirectBatchEnrollmentUrl,
  createScheduledEnrollmentForm,
  updateScheduledEnrollmentForm,
  deleteScheduledEnrollmentForm,
  getScheduledEnrollmentForms,
  subscribeToScheduledEnrollmentForms,
  subscribeToAllEnrollmentForms,
  computeScheduledFormStatus,
} from "../../features/enrollment/enrollment-utils";
import {
  exportEnrollmentFormsToExcel,
  exportBatchEnrollmentForms,
} from "../../features/enrollment/enrollment-export";
import { downloadEnrollmentPDF } from "../../features/enrollment/enrollment-pdf";
import { EnrollmentFormPreview } from "../../features/enrollment/enrollment-form-components";
import { Timestamp } from "firebase/firestore";

interface ScheduledFormModalState {
  id?: string;
  batchId: string;
  formTitle: string;
  courseName: string;
  startingDate: string;
  duration: string;
  note: string;
  scheduleStart: string;
  scheduleEnd: string;
  isOpen: boolean;
}

export default function EnrollmentManagement() {
  const { user } = useAuth();
  const { batches } = useData();
  const location = useLocation();
  const navigate = useNavigate();

  // Determine initial batch from query string if available
  const queryParams = new URLSearchParams(location.search);
  const paramBatchId = queryParams.get("batchId");

  const [selectedBatch, setSelectedBatch] = useState<string>(
    paramBatchId &&
      (paramBatchId === "all" || batches.some((b) => b.id === paramBatchId))
      ? paramBatchId
      : "all",
  );

  // Scope for scheduled forms: "all" displays forms across all batches, "selected" displays only active batch
  const [scheduledFormsScope, setScheduledFormsScope] = useState<
    "all" | "selected"
  >("all");

  const [forms, setForms] = useState<EnrollmentForm[]>([]);
  const [scheduledForms, setScheduledForms] = useState<
    ScheduledEnrollmentForm[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Link Copy states
  const [copiedDirectLink, setCopiedDirectLink] = useState(false);
  const [copiedFormId, setCopiedFormId] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFormFilter, setSelectedFormFilter] = useState<string>("all");

  // Create / Edit Scheduled Form Dialog
  const [showFormModal, setShowFormModal] = useState(false);
  const [modalData, setModalData] = useState<ScheduledFormModalState>({
    batchId: selectedBatch !== "all" ? selectedBatch : batches[0]?.id || "",
    formTitle: "",
    courseName: "",
    startingDate: "",
    duration: "60 Days / 120 Hours",
    note: "Admissions strictly based on qualification verification.",
    scheduleStart: "",
    scheduleEnd: "",
    isOpen: true,
  });
  const [modalSaving, setModalSaving] = useState(false);

  const currentBatch = batches.find((b) => b.id === selectedBatch);

  // Sync selectedBatch if param updates
  useEffect(() => {
    if (
      paramBatchId &&
      (paramBatchId === "all" || batches.some((b) => b.id === paramBatchId))
    ) {
      setSelectedBatch(paramBatchId);
    }
  }, [batches, paramBatchId]);

  // Load forms and scheduled forms
  const loadData = async () => {
    setLoading(true);
    try {
      const [allForms, allScheduledForms] = await Promise.all([
        getAllEnrollmentForms(),
        getScheduledEnrollmentForms(),
      ]);

      setForms(allForms);
      setScheduledForms(allScheduledForms);
    } catch (error) {
      console.error("Failed to load enrollment data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    const unsubScheduled = subscribeToScheduledEnrollmentForms(
      (newScheduled) => {
        setScheduledForms(newScheduled);
        setLoading(false);
      },
    );

    const unsubForms = subscribeToAllEnrollmentForms((newForms) => {
      setForms(newForms);
    });

    return () => {
      unsubScheduled();
      unsubForms();
    };
  }, []);

  const handleBatchChange = (newBatchId: string) => {
    setSelectedBatch(newBatchId);
    setSelectedFormFilter("all");
    navigate(`/admin/enrollments?batchId=${newBatchId}`, { replace: true });
  };

  // Open Create Form Dialog
  const handleOpenCreateForm = () => {
    const defaultBatchId =
      selectedBatch && selectedBatch !== "all"
        ? selectedBatch
        : batches[0]?.id || "";
    const activeBatchObj = batches.find((b) => b.id === defaultBatchId);

    setModalData({
      batchId: defaultBatchId,
      formTitle: `${activeBatchObj?.name || "Batch"} Enrollment Form`,
      courseName: activeBatchObj?.name || "ONLINE LIVE CRASH COURSE",
      startingDate: activeBatchObj?.schedule || "Immediate / To be announced",
      duration: "60 Days / 120 Hours",
      note: "Admissions strictly based on qualification verification. Keep video ON during live CBT tests.",
      scheduleStart: "",
      scheduleEnd: "",
      isOpen: true,
    });
    setShowFormModal(true);
  };

  // Open Edit Form Dialog
  const handleOpenEditForm = (form: ScheduledEnrollmentForm) => {
    setModalData({
      id: form.id,
      batchId: form.batchId,
      formTitle: form.formTitle,
      courseName: form.courseName,
      startingDate: form.startingDate,
      duration: form.duration,
      note: form.note || "",
      scheduleStart: form.scheduleStart || "",
      scheduleEnd: form.scheduleEnd || "",
      isOpen: form.isOpen ?? true,
    });
    setShowFormModal(true);
  };

  // Save Scheduled Form (Create or Edit)
  const handleSaveScheduledForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalData.formTitle.trim() || !modalData.batchId) {
      alert("Please provide a Form Title and select a Target Batch.");
      return;
    }

    setModalSaving(true);
    try {
      const targetBatch = batches.find((b) => b.id === modalData.batchId);
      const batchName = targetBatch?.name || "";

      if (modalData.id) {
        // Edit
        await updateScheduledEnrollmentForm(modalData.id, {
          batchId: modalData.batchId,
          batchName,
          formTitle: modalData.formTitle.trim(),
          courseName: modalData.courseName.trim(),
          startingDate: modalData.startingDate.trim(),
          duration: modalData.duration.trim(),
          note: modalData.note.trim(),
          scheduleStart: modalData.scheduleStart || "",
          scheduleEnd: modalData.scheduleEnd || "",
          isOpen: modalData.isOpen,
          status: modalData.isOpen ? "active" : "closed",
        });
        setScheduledForms((prev) =>
          prev.map((f) =>
            f.id === modalData.id
              ? {
                  ...f,
                  batchId: modalData.batchId,
                  batchName,
                  formTitle: modalData.formTitle.trim(),
                  courseName: modalData.courseName.trim(),
                  startingDate: modalData.startingDate.trim(),
                  duration: modalData.duration.trim(),
                  note: modalData.note.trim(),
                  scheduleStart: modalData.scheduleStart || "",
                  scheduleEnd: modalData.scheduleEnd || "",
                  isOpen: modalData.isOpen,
                  status: modalData.isOpen ? "active" : "closed",
                }
              : f,
          ),
        );
      } else {
        // Create
        const created = await createScheduledEnrollmentForm({
          batchId: modalData.batchId,
          batchName,
          formTitle: modalData.formTitle.trim(),
          courseName: modalData.courseName.trim(),
          startingDate: modalData.startingDate.trim(),
          duration: modalData.duration.trim(),
          note: modalData.note.trim(),
          scheduleStart: modalData.scheduleStart || "",
          scheduleEnd: modalData.scheduleEnd || "",
          isOpen: modalData.isOpen,
          status: modalData.isOpen ? "active" : "closed",
        });
        setScheduledForms((prev) => [
          created,
          ...prev.filter((f) => f.id !== created.id),
        ]);
        // If viewing a specific batch that is different from target batch, switch to the new batch so it's directly visible
        if (selectedBatch !== "all" && selectedBatch !== modalData.batchId) {
          setSelectedBatch(modalData.batchId);
        }
      }

      setShowFormModal(false);
      loadData();
    } catch (err: any) {
      console.error("Save scheduled form failed:", err);
      alert(err?.message || "Failed to save scheduled form.");
    } finally {
      setModalSaving(false);
    }
  };

  // Delete Scheduled Form
  const handleDeleteScheduledForm = async (formId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this scheduled form? Its link will be deactivated.",
      )
    ) {
      return;
    }
    try {
      await deleteScheduledEnrollmentForm(formId);
      setScheduledForms((prev) => prev.filter((f) => f.id !== formId));
    } catch (err) {
      console.error("Delete form failed:", err);
      alert("Failed to delete form.");
    }
  };

  // Toggle Form Open/Close
  const handleToggleFormStatus = async (form: ScheduledEnrollmentForm) => {
    const nextIsOpen = !form.isOpen;
    try {
      await updateScheduledEnrollmentForm(form.id, {
        isOpen: nextIsOpen,
        status: nextIsOpen ? "active" : "closed",
      });
      setScheduledForms((prev) =>
        prev.map((f) =>
          f.id === form.id
            ? {
                ...f,
                isOpen: nextIsOpen,
                status: nextIsOpen ? "active" : "closed",
              }
            : f,
        ),
      );
    } catch (err) {
      console.error("Toggle form status failed:", err);
      alert("Failed to toggle form status.");
    }
  };

  // Copy Link for a Scheduled Form
  const handleCopyFormLink = (formId: string) => {
    const url = `${window.location.origin}/enroll/${formId}`;
    navigator.clipboard.writeText(url);
    setCopiedFormId(formId);
    setTimeout(() => setCopiedFormId(null), 2500);
  };

  // Copy Default Batch Link
  const handleCopyDirectBatchLink = () => {
    const url = getDirectBatchEnrollmentUrl(selectedBatch);
    navigator.clipboard.writeText(url);
    setCopiedDirectLink(true);
    setTimeout(() => setCopiedDirectLink(false), 2500);
  };

  // Approve Application
  const handleApprove = async (formId: string) => {
    if (
      !window.confirm(
        "Approve this student application? This will create their student portal account and enable Google/Username login.",
      )
    ) {
      return;
    }
    setActionLoadingId(formId);
    try {
      await approveStudentEnrollment(formId, user?.email || "admin");
      setForms((prev) =>
        prev.map((f) =>
          f.id === formId
            ? { ...f, status: "approved", approvalStatus: "approved" }
            : f,
        ),
      );
    } catch (err: any) {
      console.error("Approve failed:", err);
      alert(err?.message || "Failed to approve student enrollment.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Reject Application
  const handleReject = async (formId: string) => {
    const reason = window.prompt(
      "Enter rejection reason (optional):",
      "Incomplete or unverified qualifications",
    );
    if (reason === null) return;

    setActionLoadingId(formId);
    try {
      await rejectStudentEnrollment(formId, reason);
      setForms((prev) =>
        prev.map((f) =>
          f.id === formId
            ? {
                ...f,
                status: "rejected",
                approvalStatus: "rejected",
                rejectionReason: reason,
              }
            : f,
        ),
      );
    } catch (err: any) {
      console.error("Reject failed:", err);
      alert("Failed to reject student enrollment.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete Application
  const handleDeleteApplication = async (formId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this application permanently?",
      )
    ) {
      return;
    }
    try {
      await deleteEnrollmentForm(formId);
      setForms((prev) => prev.filter((f) => f.id !== formId));
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete application.");
    }
  };

  // Scheduled forms under currently selected batch (or all)
  const batchScheduledForms =
    !selectedBatch || selectedBatch === "all"
      ? scheduledForms
      : scheduledForms.filter((f) => f.batchId === selectedBatch);

  // Forms to display based on scheduledFormsScope
  const displayedScheduledForms =
    scheduledFormsScope === "all" || !selectedBatch || selectedBatch === "all"
      ? scheduledForms
      : scheduledForms.filter((f) => f.batchId === selectedBatch);

  // Filter applications by selected batch & form filter & search
  const batchForms =
    !selectedBatch || selectedBatch === "all"
      ? forms
      : forms.filter(
          (f) =>
            f.batchId === selectedBatch ||
            (f.scheduledFormId &&
              scheduledForms.some(
                (sf) =>
                  sf.id === f.scheduledFormId && sf.batchId === selectedBatch,
              )),
        );

  const filteredForms = forms.filter((f) => {
    // If a specific form is filtered, match directly
    if (selectedFormFilter !== "all") {
      if (f.scheduledFormId !== selectedFormFilter) return false;
    } else if (selectedBatch && selectedBatch !== "all") {
      // Otherwise check batch match
      const isBatchMatch =
        f.batchId === selectedBatch ||
        (f.scheduledFormId &&
          scheduledForms.some(
            (sf) => sf.id === f.scheduledFormId && sf.batchId === selectedBatch,
          ));
      if (!isBatchMatch) return false;
    }

    // Search filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (
      f.personalDetails?.studentName ||
      f.personalDetails?.candidateName ||
      ""
    ).toLowerCase();
    const email = (f.personalDetails?.email || "").toLowerCase();
    const mobile = (f.personalDetails?.mobileNo || "").toLowerCase();
    const username = (f.portalUsername || "").toLowerCase();
    const bName = (
      f.batchName ||
      batches.find((b) => b.id === f.batchId)?.name ||
      ""
    ).toLowerCase();
    const fTitle = (f.scheduledFormTitle || "").toLowerCase();

    return (
      name.includes(q) ||
      email.includes(q) ||
      mobile.includes(q) ||
      username.includes(q) ||
      bName.includes(q) ||
      fTitle.includes(q)
    );
  });

  const pendingForms = filteredForms.filter(
    (f) =>
      f.approvalStatus === "pending" ||
      (!f.approvalStatus &&
        (f.status === "submitted" ||
          !f.status ||
          (f.status as string) === "pending")),
  );
  const approvedForms = filteredForms.filter(
    (f) => f.approvalStatus === "approved" || f.status === "approved",
  );
  const rejectedForms = filteredForms.filter(
    (f) => f.approvalStatus === "rejected" || f.status === "rejected",
  );

  const formatDate = (date: any): string => {
    if (!date) return "—";
    if (date instanceof Timestamp) return date.toDate().toLocaleDateString();
    if (date instanceof Date) return date.toLocaleDateString();
    return String(date);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5">
            <Users className="w-8 h-8 text-indigo-600" />
            Batch Enrollment &amp; Scheduled Forms
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Create and schedule enrollment forms as needed under any batch, copy
            unique form links, and approve registered students.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRefreshing(true);
              loadData();
            }}
            disabled={refreshing || loading}
            className="gap-1.5"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={handleOpenCreateForm}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create &amp; Schedule Form
          </Button>
        </div>
      </div>

      {/* Target Batch Bar */}
      <Card className="border-indigo-100 bg-white shadow-sm">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
              Active Batch:
            </span>
            <select
              className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none min-w-[260px]"
              value={selectedBatch}
              onChange={(e) => handleBatchChange(e.target.value)}
            >
              <option value="all">🌟 All Batches (Overview)</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name} ({batch.studentCount || 0} students)
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium">
              Forms: {displayedScheduledForms.length}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
              Total Applicants: {batchForms.length}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200">
              Pending: {pendingForms.length}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
              Approved: {approvedForms.length}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 1: SCHEDULED ENROLLMENT FORMS LIST */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-indigo-50 via-purple-50 to-white border-b border-indigo-100 py-4 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <CardTitle className="text-base md:text-lg font-bold text-indigo-950 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                Scheduled Enrollment Forms ({displayedScheduledForms.length})
              </CardTitle>

              {/* Scope toggle buttons */}
              <div className="inline-flex rounded-lg bg-slate-200/80 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setScheduledFormsScope("all")}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    scheduledFormsScope === "all"
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All Batches ({scheduledForms.length})
                </button>
                {selectedBatch && selectedBatch !== "all" && (
                  <button
                    type="button"
                    onClick={() => setScheduledFormsScope("selected")}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      scheduledFormsScope === "selected"
                        ? "bg-white text-indigo-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    This Batch (
                    {
                      scheduledForms.filter((f) => f.batchId === selectedBatch)
                        .length
                    }
                    )
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Create and schedule different enrollment forms under any batch.
              Each gets its own unique public URL for student admissions.
            </p>
          </div>

          <Button
            size="sm"
            onClick={handleOpenCreateForm}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />+ New Scheduled Form
          </Button>
        </CardHeader>

        <CardContent className="p-6">
          {displayedScheduledForms.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 space-y-3">
              <Calendar className="w-10 h-10 text-slate-400 mx-auto" />
              <div>
                <h3 className="text-sm font-bold text-slate-700">
                  {scheduledFormsScope === "selected" &&
                  scheduledForms.length > 0
                    ? `No forms scheduled specifically for this batch yet, but ${scheduledForms.length} form(s) exist in other batches.`
                    : "No scheduled enrollment forms created yet"}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  {scheduledFormsScope === "selected" &&
                  scheduledForms.length > 0
                    ? "Click 'All Batches' above to view existing forms, or create a new form specifically for this batch."
                    : "Click the button below to create your first scheduled enrollment form. You can configure course info, schedule dates, and copy the public student registration link."}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                {scheduledFormsScope === "selected" &&
                  scheduledForms.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setScheduledFormsScope("all")}
                      className="text-xs"
                    >
                      View All Batches Forms ({scheduledForms.length})
                    </Button>
                  )}
                <Button
                  size="sm"
                  onClick={handleOpenCreateForm}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Create Form
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs font-bold uppercase">
                      Form Title &amp; Course
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase">
                      Target Batch
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase">
                      Schedule Window
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase">
                      Status
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase">
                      Submissions
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase">
                      Public Link
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedScheduledForms.map((item) => {
                    const statusCheck = computeScheduledFormStatus(item);
                    const formSubmissions = forms.filter(
                      (f) => f.scheduledFormId === item.id,
                    );
                    const formPending = formSubmissions.filter(
                      (f) => f.approvalStatus === "pending",
                    );
                    const formUrl = `${window.location.origin}/enroll/${item.id}`;
                    const isCopied = copiedFormId === item.id;
                    const matchedBatch = batches.find(
                      (b) => b.id === item.batchId,
                    );

                    return (
                      <TableRow key={item.id} className="hover:bg-slate-50/80">
                        <TableCell>
                          <div className="font-bold text-slate-900 text-sm">
                            {item.formTitle}
                          </div>
                          <div className="text-xs font-medium text-indigo-700 mt-0.5">
                            {item.courseName}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Start: {item.startingDate || "—"} • Duration:{" "}
                            {item.duration || "—"}
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="outline"
                            className="bg-indigo-50/70 border-indigo-200 text-indigo-800 text-[11px] font-semibold"
                          >
                            {item.batchName ||
                              matchedBatch?.name ||
                              item.batchId ||
                              "Batch"}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="text-xs space-y-0.5">
                            <div>
                              <span className="text-slate-400">Opens:</span>{" "}
                              <span className="font-medium text-slate-700">
                                {item.scheduleStart
                                  ? new Date(item.scheduleStart).toLocaleString(
                                      [],
                                      {
                                        dateStyle: "short",
                                        timeStyle: "short",
                                      },
                                    )
                                  : "Immediate"}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">Closes:</span>{" "}
                              <span className="font-medium text-slate-700">
                                {item.scheduleEnd
                                  ? new Date(item.scheduleEnd).toLocaleString(
                                      [],
                                      {
                                        dateStyle: "short",
                                        timeStyle: "short",
                                      },
                                    )
                                  : "Until Closed"}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                                statusCheck.status === "active"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : statusCheck.status === "scheduled"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                  statusCheck.status === "active"
                                    ? "bg-emerald-500 animate-pulse"
                                    : statusCheck.status === "scheduled"
                                      ? "bg-amber-500"
                                      : "bg-rose-500"
                                }`}
                              />
                              {statusCheck.status === "active"
                                ? "Active / Open"
                                : statusCheck.status === "scheduled"
                                  ? "Scheduled"
                                  : "Closed"}
                            </span>
                            {statusCheck.message && (
                              <div
                                className="text-[10px] text-slate-400 max-w-[160px] truncate"
                                title={statusCheck.message}
                              >
                                {statusCheck.message}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFormFilter(item.id);
                                document
                                  .getElementById("applications-section")
                                  ?.scrollIntoView({ behavior: "smooth" });
                              }}
                              className="text-left font-semibold text-indigo-700 hover:text-indigo-900 cursor-pointer"
                              title="Click to view applications for this form"
                            >
                              <span className="font-bold text-slate-900">
                                {formSubmissions.length}
                              </span>{" "}
                              Total
                            </button>
                            {formPending.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedFormFilter(item.id);
                                  document
                                    .getElementById("applications-section")
                                    ?.scrollIntoView({ behavior: "smooth" });
                                }}
                                className="ml-1.5 inline-flex items-center cursor-pointer hover:opacity-80 transition"
                                title="Click to view pending applications for this form"
                              >
                                <Badge className="bg-amber-500 hover:bg-amber-600 text-[10px] px-1.5 py-0 cursor-pointer">
                                  {formPending.length} Pending
                                </Badge>
                              </button>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCopyFormLink(item.id)}
                              className="h-8 px-2 text-xs font-semibold text-indigo-700 border-indigo-200 hover:bg-indigo-50 gap-1"
                            >
                              {isCopied ? (
                                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              {isCopied ? "Copied" : "Copy Link"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(formUrl, "_blank")}
                              className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600"
                              title="Open public form"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenEditForm(item)}
                              className="h-8 px-2 text-slate-600 hover:text-indigo-600"
                              title="Edit Form Settings"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleFormStatus(item)}
                              className={`h-8 px-2 text-xs font-medium ${item.isOpen ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"}`}
                              title={
                                item.isOpen
                                  ? "Close admissions"
                                  : "Open admissions"
                              }
                            >
                              {item.isOpen ? "Close" : "Open"}
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteScheduledForm(item.id)}
                              className="h-8 px-2 text-slate-400 hover:text-rose-600"
                              title="Delete Form"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 2: CANDIDATE APPLICATIONS & APPROVAL MANAGEMENT */}
      <Card
        id="applications-section"
        className="border-slate-200 shadow-sm scroll-mt-6"
      >
        <CardHeader className="py-4 px-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold text-slate-900">
              Candidate Applications &amp; Approval Management
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and approve registered candidates. Students cannot log in
              with Google or Username/Password until approved.
            </p>
          </div>

          {/* Form Filter & Search Bar */}
          <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
            {scheduledForms.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-medium text-slate-800 focus:ring-1 focus:ring-indigo-500"
                  value={selectedFormFilter}
                  onChange={(e) => setSelectedFormFilter(e.target.value)}
                >
                  <option value="all">
                    All Forms (
                    {selectedBatch === "all" ? forms.length : batchForms.length}
                    )
                  </option>
                  {(selectedBatch === "all"
                    ? scheduledForms
                    : batchScheduledForms
                  ).map((sf) => (
                    <option key={sf.id} value={sf.id}>
                      {sf.formTitle} (
                      {forms.filter((f) => f.scheduledFormId === sf.id).length})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search candidate, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger
                value="pending"
                className="font-semibold text-xs sm:text-sm"
              >
                Pending Approval{" "}
                <Badge className="ml-1.5 bg-amber-500">
                  {pendingForms.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="approved"
                className="font-semibold text-xs sm:text-sm"
              >
                Approved{" "}
                <Badge className="ml-1.5 bg-emerald-600">
                  {approvedForms.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="rejected"
                className="font-semibold text-xs sm:text-sm"
              >
                Rejected{" "}
                <Badge className="ml-1.5 bg-rose-500">
                  {rejectedForms.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="all"
                className="font-semibold text-xs sm:text-sm"
              >
                All{" "}
                <Badge className="ml-1.5 bg-slate-500">
                  {filteredForms.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {["pending", "approved", "rejected", "all"].map((tabKey) => {
              const currentList =
                tabKey === "pending"
                  ? pendingForms
                  : tabKey === "approved"
                    ? approvedForms
                    : tabKey === "rejected"
                      ? rejectedForms
                      : filteredForms;

              return (
                <TabsContent key={tabKey} value={tabKey} className="space-y-4">
                  {currentList.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-sm">
                      No applications found in this category.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-xs font-bold uppercase">
                              Candidate Name
                            </TableHead>
                            <TableHead className="text-xs font-bold uppercase">
                              Form / Course
                            </TableHead>
                            <TableHead className="text-xs font-bold uppercase">
                              Contact Info
                            </TableHead>
                            <TableHead className="text-xs font-bold uppercase">
                              Qualifications
                            </TableHead>
                            <TableHead className="text-xs font-bold uppercase">
                              Work &amp; Experience
                            </TableHead>
                            <TableHead className="text-xs font-bold uppercase">
                              Portal Credentials
                            </TableHead>
                            <TableHead className="text-xs font-bold uppercase">
                              Status
                            </TableHead>
                            <TableHead className="text-xs font-bold uppercase text-right">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentList.map((form) => {
                            const p = form.personalDetails;
                            const d =
                              form.demographicDetails || form.otherDetails;
                            const ed = form.educationalDetails;
                            const isPending =
                              form.approvalStatus === "pending" ||
                              (!form.approvalStatus &&
                                form.status === "submitted");

                            return (
                              <TableRow
                                key={form.id}
                                className="hover:bg-slate-50/70"
                              >
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    {p?.photoURL ? (
                                      <img
                                        src={p.photoURL}
                                        alt={p.studentName || "Candidate"}
                                        className="w-10 h-12 object-cover rounded border border-slate-200 shrink-0 shadow-xs"
                                      />
                                    ) : (
                                      <div className="w-10 h-12 rounded border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                                        <User className="w-5 h-5 text-slate-300" />
                                      </div>
                                    )}
                                    <div>
                                      <div className="font-bold text-slate-900">
                                        {p?.studentName || p?.candidateName}
                                      </div>
                                      <div className="text-xs text-slate-500">
                                        Father: {p?.fatherName || "—"}
                                      </div>
                                      <div className="text-[11px] text-slate-400 capitalize">
                                        {p?.gender} • {d?.maritalStatus}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <div className="text-xs font-bold text-indigo-900">
                                    {form.scheduledFormTitle ||
                                      form.courseName ||
                                      "Default Form"}
                                  </div>
                                  <div className="text-[10px] text-slate-500 mt-0.5">
                                    Batch: {form.batchName || "—"}
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <div className="text-xs font-medium text-slate-800">
                                    {p?.email}
                                  </div>
                                  <div className="text-xs text-slate-600 mt-0.5">
                                    📞 {p?.mobileNo}
                                  </div>
                                  {p?.whatsappNo && (
                                    <div className="text-[11px] text-emerald-700">
                                      💬 {p.whatsappNo}
                                    </div>
                                  )}
                                </TableCell>

                                <TableCell>
                                  <div className="text-xs space-y-1">
                                    {ed?.records?.map((r, i) => (
                                      <div
                                        key={i}
                                        className="text-slate-700 font-medium"
                                      >
                                        <span className="font-bold text-indigo-700">
                                          {r.degree || r.tier}
                                        </span>{" "}
                                        (
                                        {r.major === "Other"
                                          ? r.otherMajor
                                          : r.major || r.majorStream}
                                        : {r.percentage || r.percentageOfMarks}
                                        %)
                                        {r.pstm === "Yes" && (
                                          <Badge
                                            variant="outline"
                                            className="ml-1 text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                                          >
                                            PSTM
                                          </Badge>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <div className="text-xs font-medium text-slate-800">
                                    {d?.workStatus || "—"}
                                  </div>
                                  {d?.departmentName && (
                                    <div className="text-[11px] text-indigo-700 font-medium">
                                      Dept: {d.departmentName}
                                    </div>
                                  )}
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    TNPSC: {d?.previousTnpscExperience || "—"}
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <div className="space-y-1 text-xs font-mono">
                                    <div>
                                      <span className="text-slate-400 text-[10px]">
                                        User:
                                      </span>{" "}
                                      <span className="font-semibold text-slate-900">
                                        {form.portalUsername}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px]">
                                        Pass:
                                      </span>{" "}
                                      <span className="font-semibold text-slate-900">
                                        {form.portalPassword}
                                      </span>
                                    </div>
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                                      form.approvalStatus === "approved"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : form.approvalStatus === "rejected"
                                          ? "bg-rose-100 text-rose-800"
                                          : "bg-amber-100 text-amber-800"
                                    }`}
                                  >
                                    {form.approvalStatus === "approved"
                                      ? "Approved"
                                      : form.approvalStatus === "rejected"
                                        ? "Rejected"
                                        : "Pending"}
                                  </span>
                                  <div className="text-[10px] text-slate-400 mt-1">
                                    {formatDate(form.createdAt)}
                                  </div>
                                </TableCell>

                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {isPending && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleApprove(form.id)}
                                        disabled={actionLoadingId === form.id}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-2.5 gap-1 font-semibold"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Approve
                                      </Button>
                                    )}

                                    {isPending && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleReject(form.id)}
                                        disabled={actionLoadingId === form.id}
                                        className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs h-8 px-2"
                                        title="Reject Application"
                                      >
                                        <XCircle className="w-3.5 h-3.5" />
                                      </Button>
                                    )}

                                    {/* View Full Modal */}
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 px-2 text-indigo-600 hover:bg-indigo-50"
                                        >
                                          View
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                                        <DialogHeader>
                                          <DialogTitle>
                                            Application:{" "}
                                            {p?.studentName || p?.candidateName}
                                          </DialogTitle>
                                        </DialogHeader>
                                        <EnrollmentFormPreview form={form} />
                                        <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-1.5"
                                            onClick={() =>
                                              downloadEnrollmentPDF(form)
                                            }
                                          >
                                            <FileDown className="w-4 h-4" />{" "}
                                            Download PDF
                                          </Button>

                                          {isPending && (
                                            <Button
                                              size="sm"
                                              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                                              onClick={() =>
                                                handleApprove(form.id)
                                              }
                                            >
                                              <CheckCircle2 className="w-4 h-4" />{" "}
                                              Approve &amp; Activate Account
                                            </Button>
                                          )}
                                        </div>
                                      </DialogContent>
                                    </Dialog>

                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      title="Download PDF"
                                      className="h-8 px-2 text-slate-500 hover:text-indigo-600"
                                      onClick={() =>
                                        downloadEnrollmentPDF(form)
                                      }
                                    >
                                      <FileDown className="w-3.5 h-3.5" />
                                    </Button>

                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      title="Delete Record"
                                      className="h-8 px-2 text-slate-400 hover:text-rose-600"
                                      onClick={() =>
                                        handleDeleteApplication(form.id)
                                      }
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>

          {/* Export Actions */}
          <div className="mt-6 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              Export all {batchForms.length} applications for this batch to an
              Excel spreadsheet (.xlsx).
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportBatchEnrollmentForms(
                  batchForms,
                  currentBatch?.name || "Batch",
                )
              }
              disabled={batchForms.length === 0}
              className="gap-2 text-xs"
            >
              <Download className="w-4 h-4" />
              Export Batch to Excel (.xlsx)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* CREATE / EDIT SCHEDULED FORM MODAL */}
      <Dialog open={showFormModal} onOpenChange={setShowFormModal}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              {modalData.id
                ? "Edit Scheduled Enrollment Form"
                : "Create & Schedule New Enrollment Form"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveScheduledForm} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Target Batch *
              </label>
              <select
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                value={modalData.batchId}
                onChange={(e) => {
                  const bId = e.target.value;
                  const b = batches.find((x) => x.id === bId);
                  setModalData({
                    ...modalData,
                    batchId: bId,
                    courseName: modalData.courseName || b?.name || "",
                  });
                }}
                required
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.studentCount || 0} students)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Form Title / Campaign Name *
              </label>
              <Input
                placeholder="e.g. October Batch Regular Admission / Fast-Track Crash Course"
                value={modalData.formTitle}
                onChange={(e) =>
                  setModalData({ ...modalData, formTitle: e.target.value })
                }
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Online Live Crash Course Name (Displayed on Form Banner) *
              </label>
              <Input
                placeholder="e.g. TNPSC COMBINED STATISTICAL SERVICES EXAMINATION - ONLINE LIVE CRASH COURSE"
                value={modalData.courseName}
                onChange={(e) =>
                  setModalData({ ...modalData, courseName: e.target.value })
                }
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Starting Date *
                </label>
                <Input
                  placeholder="e.g. 15th October 2026 / Immediate"
                  value={modalData.startingDate}
                  onChange={(e) =>
                    setModalData({ ...modalData, startingDate: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Course Duration *
                </label>
                <Input
                  placeholder="e.g. 60 Days / 120 Hours"
                  value={modalData.duration}
                  onChange={(e) =>
                    setModalData({ ...modalData, duration: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            {/* Schedule Window */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                Schedule Opening &amp; Closing Window (Optional)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Form Opening Date &amp; Time
                  </label>
                  <Input
                    type="datetime-local"
                    value={modalData.scheduleStart}
                    onChange={(e) =>
                      setModalData({
                        ...modalData,
                        scheduleStart: e.target.value,
                      })
                    }
                    className="text-xs"
                  />
                  <span className="text-[10px] text-slate-400">
                    Leave blank for immediate opening
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Deadline / Closing Date &amp; Time
                  </label>
                  <Input
                    type="datetime-local"
                    value={modalData.scheduleEnd}
                    onChange={(e) =>
                      setModalData({
                        ...modalData,
                        scheduleEnd: e.target.value,
                      })
                    }
                    className="text-xs"
                  />
                  <span className="text-[10px] text-slate-400">
                    Leave blank for no automatic deadline
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Admin Banner Note for Students (Optional)
              </label>
              <Textarea
                placeholder="e.g. Admissions strictly based on qualification verification. Keep video ON during live CBT tests."
                value={modalData.note}
                onChange={(e) =>
                  setModalData({ ...modalData, note: e.target.value })
                }
                rows={2}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Form Status
              </label>
              <select
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                value={modalData.isOpen ? "open" : "closed"}
                onChange={(e) =>
                  setModalData({
                    ...modalData,
                    isOpen: e.target.value === "open",
                  })
                }
              >
                <option value="open">
                  Open / Active (Students can enroll)
                </option>
                <option value="closed">Closed / Disabled</option>
              </select>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFormModal(false)}
                disabled={modalSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={modalSaving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              >
                {modalSaving
                  ? "Saving..."
                  : modalData.id
                    ? "Update Form"
                    : "Create Form & Generate Link"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
