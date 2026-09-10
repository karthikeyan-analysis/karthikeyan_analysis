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
} from "lucide-react";
import type {
  BatchEnrollmentConfig,
  EnrollmentForm,
  ShareableFormLink,
} from "../../features/enrollment/enrollment-types";
import {
  getAllEnrollmentForms,
  getEnrollmentFormsByBatch,
  getBatchEnrollmentConfig,
  saveBatchEnrollmentConfig,
  approveStudentEnrollment,
  rejectStudentEnrollment,
  deleteEnrollmentForm,
  getDirectBatchEnrollmentUrl,
  createShareableLink,
  getShareableLinksByBatch,
  revokeShareableLink,
  generateShareableUrl,
} from "../../features/enrollment/enrollment-utils";
import {
  exportEnrollmentFormsToExcel,
  exportBatchEnrollmentForms,
} from "../../features/enrollment/enrollment-export";
import { downloadEnrollmentPDF } from "../../features/enrollment/enrollment-pdf";
import { EnrollmentFormPreview } from "../../features/enrollment/enrollment-form-components";
import { Timestamp } from "firebase/firestore";

export default function EnrollmentManagement() {
  const { user } = useAuth();
  const { batches } = useData();
  const location = useLocation();
  const navigate = useNavigate();

  // Determine initial batch from query string if available
  const queryParams = new URLSearchParams(location.search);
  const paramBatchId = queryParams.get("batchId");

  const [selectedBatch, setSelectedBatch] = useState<string>(
    paramBatchId && batches.some((b) => b.id === paramBatchId)
      ? paramBatchId
      : batches[0]?.id || "",
  );

  const [forms, setForms] = useState<EnrollmentForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Batch Configuration State
  const [config, setConfig] = useState<BatchEnrollmentConfig>({
    batchId: selectedBatch,
    courseName: "",
    startingDate: "",
    duration: "",
    note: "",
    isOpen: true,
  });
  const [configSaving, setConfigSaving] = useState(false);
  const [configSavedToast, setConfigSavedToast] = useState(false);

  // Link Copy states
  const [copiedDirectLink, setCopiedDirectLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Shareable Links (legacy/custom)
  const [shareableLinks, setShareableLinks] = useState<ShareableFormLink[]>([]);
  const [showNewLinkDialog, setShowNewLinkDialog] = useState(false);
  const [newLinkExpiry, setNewLinkExpiry] = useState<string>("30");

  const currentBatch = batches.find((b) => b.id === selectedBatch);

  // Sync selectedBatch if batches load late or param updates
  useEffect(() => {
    if (!selectedBatch && batches.length > 0) {
      setSelectedBatch(paramBatchId || batches[0].id);
    }
  }, [batches, paramBatchId, selectedBatch]);

  // Load forms and batch enrollment config
  const loadData = async () => {
    setLoading(true);
    try {
      const [allForms, batchConfig, links] = await Promise.all([
        getAllEnrollmentForms(),
        selectedBatch ? getBatchEnrollmentConfig(selectedBatch) : null,
        selectedBatch ? getShareableLinksByBatch(selectedBatch) : [],
      ]);

      setForms(allForms);
      setShareableLinks(links);

      if (batchConfig) {
        setConfig(batchConfig);
      } else if (currentBatch) {
        setConfig({
          batchId: selectedBatch,
          courseName: currentBatch.name || "",
          startingDate: currentBatch.schedule || "",
          duration: "60 Days / 120 Hours",
          note: "Admissions strictly based on qualification verification.",
          isOpen: true,
        });
      }
    } catch (error) {
      console.error("Failed to load enrollment data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedBatch) {
      loadData();
    }
  }, [selectedBatch]);

  const handleBatchChange = (newBatchId: string) => {
    setSelectedBatch(newBatchId);
    navigate(`/admin/enrollments?batchId=${newBatchId}`, { replace: true });
  };

  // Save Batch Header Information (Admin / Editable Box)
  const handleSaveConfig = async () => {
    if (!selectedBatch) return;
    setConfigSaving(true);
    try {
      await saveBatchEnrollmentConfig({
        ...config,
        batchId: selectedBatch,
      });
      setConfigSavedToast(true);
      setTimeout(() => setConfigSavedToast(false), 3000);
    } catch (err) {
      console.error("Failed to save config:", err);
      alert("Failed to save batch enrollment configuration.");
    } finally {
      setConfigSaving(false);
    }
  };

  // Copy Direct Link
  const handleCopyDirectLink = () => {
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
      // Update local state
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
  const handleDelete = async (formId: string) => {
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

  // Filter batch forms
  const batchForms = forms.filter((f) => f.batchId === selectedBatch);

  const filteredForms = batchForms.filter((f) => {
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
    return (
      name.includes(q) ||
      email.includes(q) ||
      mobile.includes(q) ||
      username.includes(q)
    );
  });

  const pendingForms = filteredForms.filter(
    (f) =>
      f.approvalStatus === "pending" ||
      (!f.approvalStatus && f.status === "submitted"),
  );
  const approvedForms = filteredForms.filter(
    (f) => f.approvalStatus === "approved",
  );
  const rejectedForms = filteredForms.filter(
    (f) => f.approvalStatus === "rejected",
  );

  const formatDate = (date: any): string => {
    if (!date) return "—";
    if (date instanceof Timestamp) return date.toDate().toLocaleDateString();
    if (date instanceof Date) return date.toLocaleDateString();
    return String(date);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5">
            <Users className="w-8 h-8 text-indigo-600" />
            Batch Enrollment &amp; Approvals
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Configure course enrollment details, copy public student form link,
            and verify &amp; approve applicants.
          </p>
        </div>

        <div className="flex items-center gap-2">
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

          {selectedBatch && (
            <Button
              size="sm"
              onClick={handleCopyDirectLink}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {copiedDirectLink ? (
                <CheckCheck className="w-4 h-4 text-emerald-300" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copiedDirectLink ? "Copied Link!" : "Copy Form Link"}
            </Button>
          )}
        </div>
      </div>

      {/* Batch Selector */}
      <Card className="border-indigo-100 bg-white shadow-sm">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
              Target Batch:
            </span>
            <select
              className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none min-w-[260px]"
              value={selectedBatch}
              onChange={(e) => handleBatchChange(e.target.value)}
            >
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name} ({batch.studentCount || 0} students)
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium">
              Total Applicants: {batchForms.length}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200">
              Pending Approval: {pendingForms.length}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
              Approved: {approvedForms.length}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Section 1: Header & Course Information (Admin / Editable Box) */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-indigo-50 via-purple-50 to-white border-b border-indigo-100 py-4 px-6 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base md:text-lg font-bold text-indigo-950 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              1. Header &amp; Course Information (Editable Box for Students)
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              These details are prominently displayed at the top of the public
              student enrollment form for this batch.
            </p>
          </div>

          <Button
            size="sm"
            onClick={handleSaveConfig}
            disabled={configSaving}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
          >
            <Save className="w-3.5 h-3.5" />
            {configSaving ? "Saving..." : "Save Header Info"}
          </Button>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          {configSavedToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Batch course information saved successfully! The public enrollment
              form will reflect these updates immediately.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Online Live Crash Course Name *
              </label>
              <Input
                placeholder="e.g. TNPSC COMBINED STATISTICAL SERVICES EXAMINATION - ONLINE LIVE CRASH COURSE"
                value={config.courseName}
                onChange={(e) =>
                  setConfig({ ...config, courseName: e.target.value })
                }
                className="font-semibold text-indigo-950"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Starting Date (Dynamic / Editable) *
              </label>
              <Input
                placeholder="e.g. 15th October 2026 / Immediate"
                value={config.startingDate}
                onChange={(e) =>
                  setConfig({ ...config, startingDate: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Duration (Dynamic / Editable) *
              </label>
              <Input
                placeholder="e.g. 60 Days / 120 Hours"
                value={config.duration}
                onChange={(e) =>
                  setConfig({ ...config, duration: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Admissions Status
              </label>
              <select
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-medium focus:ring-2 focus:ring-indigo-500 bg-white"
                value={config.isOpen ? "open" : "closed"}
                onChange={(e) =>
                  setConfig({ ...config, isOpen: e.target.value === "open" })
                }
              >
                <option value="open">
                  Admissions Open (Students can enroll)
                </option>
                <option value="closed">
                  Admissions Closed (Form disabled)
                </option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Admin Banner Note for Students (Optional)
              </label>
              <Textarea
                placeholder="e.g. Admission closes strictly 2 days before commencement of live sessions. Video must be ON during live CBT tests."
                value={config.note || ""}
                onChange={(e) => setConfig({ ...config, note: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          {/* Shareable Link Display */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Public Student Enrollment Link
              </span>
              <p className="text-xs text-slate-600 font-mono break-all select-all">
                {getDirectBatchEnrollmentUrl(selectedBatch)}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={handleCopyDirectLink}
                className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
              >
                {copiedDirectLink ? (
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-300" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copiedDirectLink ? "Copied!" : "Copy Link"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  window.open(
                    getDirectBatchEnrollmentUrl(selectedBatch),
                    "_blank",
                  )
                }
                className="gap-1.5 text-xs text-indigo-700 border-indigo-300"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Form
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Student Applications & Approvals */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="py-4 px-6 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-bold text-slate-900">
              Candidate Applications &amp; Approval Management
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Review registered candidates. Students cannot log in until
              approved by an administrator.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by name, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
            />
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

            {/* Render table for each tab */}
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
                              Contact Info
                            </TableHead>
                            <TableHead className="text-xs font-bold uppercase">
                              Qualifications
                            </TableHead>
                            <TableHead className="text-xs font-bold uppercase">
                              Work &amp; Experience
                            </TableHead>
                            <TableHead className="text-xs font-bold uppercase">
                              Generated Credentials
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
                                  <div className="font-bold text-slate-900">
                                    {p?.studentName || p?.candidateName}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    Father: {p?.fatherName || "—"}
                                  </div>
                                  <div className="text-[11px] text-slate-400 capitalize">
                                    {p?.gender} • {d?.maritalStatus}
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
                                    {/* Approve Button */}
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

                                    {/* Reject Button */}
                                    {isPending && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleReject(form.id)}
                                        disabled={actionLoadingId === form.id}
                                        className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs h-8 px-2"
                                      >
                                        <XCircle className="w-3.5 h-3.5" />
                                      </Button>
                                    )}

                                    {/* View Details Dialog */}
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
                                            Candidate Application:{" "}
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

                                    {/* Download PDF */}
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

                                    {/* Delete Button */}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      title="Delete Record"
                                      className="h-8 px-2 text-slate-400 hover:text-rose-600"
                                      onClick={() => handleDelete(form.id)}
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
              Export all {batchForms.length} submitted applications for this
              batch to an Excel spreadsheet.
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
    </div>
  );
}
