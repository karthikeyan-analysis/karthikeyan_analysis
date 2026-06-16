import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Link as LinkIcon,
  Copy,
  Download,
  Trash2,
  RefreshCw,
  Plus,
  Eye,
  EyeOff,
} from "lucide-react";
import type { EnrollmentForm, ShareableFormLink } from "./enrollment-types";
import {
  getEnrollmentFormsByBatch,
  getAllEnrollmentForms,
  createShareableLink,
  getShareableLinksByBatch,
  revokeShareableLink,
  generateShareableUrl,
} from "../../features/enrollment/enrollment-utils";
import {
  exportEnrollmentFormsToExcel,
  exportBatchEnrollmentForms,
} from "../../features/enrollment/enrollment-export";
import { Timestamp } from "firebase/firestore";

export default function EnrollmentManagement() {
  const { user } = useAuth();
  const { batches } = useData();

  const [forms, setForms] = useState<EnrollmentForm[]>([]);
  const [shareableLinks, setShareableLinks] = useState<
    Map<string, ShareableFormLink[]>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<string>(
    batches[0]?.id || "",
  );
  const [showNewLinkDialog, setShowNewLinkDialog] = useState(false);
  const [newLinkExpiry, setNewLinkExpiry] = useState<string>("30");
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Load enrollment forms
  useEffect(() => {
    const loadForms = async () => {
      setLoading(true);
      try {
        const allForms = await getAllEnrollmentForms();
        setForms(allForms);

        // Load shareable links for each batch
        const linksMap = new Map<string, ShareableFormLink[]>();
        for (const batch of batches) {
          const links = await getShareableLinksByBatch(batch.id);
          linksMap.set(batch.id, links);
        }
        setShareableLinks(linksMap);
      } catch (error) {
        console.error("Failed to load enrollment forms:", error);
      } finally {
        setLoading(false);
      }
    };

    if (batches.length > 0) {
      loadForms();
    }
  }, [batches]);

  const batchForms = forms.filter((f) => f.batchId === selectedBatch);
  const currentBatch = batches.find((b) => b.id === selectedBatch);
  const currentLinks = shareableLinks.get(selectedBatch) || [];
  const activeLinks = currentLinks.filter((l) => l.status === "active");

  const handleCreateShareableLink = async () => {
    try {
      const expiryDays = newLinkExpiry ? parseInt(newLinkExpiry) : undefined;
      const newLink = await createShareableLink(selectedBatch, expiryDays);

      setShareableLinks((prev) => {
        const updated = new Map(prev);
        const links = updated.get(selectedBatch) || [];
        updated.set(selectedBatch, [...links, newLink]);
        return updated;
      });

      setShowNewLinkDialog(false);
      setNewLinkExpiry("30");
    } catch (error) {
      console.error("Failed to create shareable link:", error);
      alert("Failed to create shareable link");
    }
  };

  const handleCopyLink = (token: string) => {
    const url = generateShareableUrl(token);
    navigator.clipboard.writeText(url);
    setCopiedLink(token);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handleRevokeLink = async (linkId: string) => {
    try {
      await revokeShareableLink(linkId);
      setShareableLinks((prev) => {
        const updated = new Map(prev);
        const links = (updated.get(selectedBatch) || []).map((l) =>
          l.id === linkId ? { ...l, status: "revoked" as const } : l,
        );
        updated.set(selectedBatch, links);
        return updated;
      });
    } catch (error) {
      console.error("Failed to revoke link:", error);
      alert("Failed to revoke link");
    }
  };

  const handleExportExcel = async () => {
    try {
      if (batchForms.length === 0) {
        alert("No forms to export for this batch");
        return;
      }
      await exportBatchEnrollmentForms(
        batchForms,
        currentBatch?.name || "Batch",
      );
    } catch (error) {
      console.error("Failed to export:", error);
      alert("Failed to export forms");
    }
  };

  const formatDate = (date: any): string => {
    if (!date) return "—";
    if (date instanceof Timestamp) return date.toDate().toLocaleDateString();
    if (date instanceof Date) return date.toLocaleDateString();
    return String(date);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4" />
          <p className="text-slate-600">Loading enrollment data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">
          Enrollment Management
        </h1>
        <p className="text-slate-600 mt-2">
          Manage student enrollment forms, create shareable links, and export
          data by badge
        </p>
      </div>

      {/* Batch Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Batch</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
          >
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name} ({batch.studentCount} students)
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="forms" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="forms">
            Forms <Badge className="ml-2">{batchForms.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="links">
            Shareable Links <Badge className="ml-2">{activeLinks.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        {/* Forms Tab */}
        <TabsContent value="forms">
          <Card>
            <CardHeader>
              <CardTitle>Enrollment Forms</CardTitle>
              <p className="text-sm text-slate-600 mt-2">
                Submitted enrollment forms for {currentBatch?.name}
              </p>
            </CardHeader>
            <CardContent>
              {batchForms.length === 0 ? (
                <p className="text-slate-500 text-center py-8">
                  No enrollment forms submitted yet
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Student Name</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Mobile</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Submitted</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {batchForms.map((form) => (
                        <TableRow key={form.id}>
                          <TableCell className="font-medium">
                            {form.personalDetails.studentName}
                          </TableCell>
                          <TableCell>{form.personalDetails.email}</TableCell>
                          <TableCell>{form.personalDetails.mobileNo}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                form.status === "submitted"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {form.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(form.createdAt)}</TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  View
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>
                                    {form.personalDetails.studentName}
                                  </DialogTitle>
                                </DialogHeader>
                                <EnrollmentFormPreview form={form} />
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shareable Links Tab */}
        <TabsContent value="links">
          <Card>
            <CardHeader className="flex justify-between items-start">
              <div>
                <CardTitle>Shareable Links</CardTitle>
                <p className="text-sm text-slate-600 mt-2">
                  Create and manage shareable enrollment form links for{" "}
                  {currentBatch?.name}
                </p>
              </div>
              <Dialog
                open={showNewLinkDialog}
                onOpenChange={setShowNewLinkDialog}
              >
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Create Link
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Shareable Link</DialogTitle>
                    <DialogDescription>
                      Generate a new shareable enrollment form link for this
                      batch
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-2 block">
                        Link Expiry (days)
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max="365"
                        value={newLinkExpiry}
                        onChange={(e) => setNewLinkExpiry(e.target.value)}
                        placeholder="30 (leave empty for no expiry)"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Leave empty for no expiry
                      </p>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setShowNewLinkDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleCreateShareableLink}>
                        Create
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {activeLinks.length === 0 ? (
                <p className="text-slate-500 text-center py-8">
                  No active shareable links. Create one to get started.
                </p>
              ) : (
                <div className="space-y-3">
                  {activeLinks.map((link) => {
                    const url = generateShareableUrl(link.token);
                    const isExpired =
                      link.expiresAt &&
                      new Date(
                        link.expiresAt instanceof Timestamp
                          ? link.expiresAt.toDate()
                          : link.expiresAt,
                      ) < new Date();

                    return (
                      <div
                        key={link.id}
                        className="p-4 border border-slate-200 rounded-lg bg-slate-50"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-white px-2 py-1 rounded border border-slate-200 font-mono truncate">
                                {link.token.substring(0, 16)}...
                              </code>
                              <Badge
                                variant={isExpired ? "destructive" : "default"}
                              >
                                {isExpired ? "Expired" : "Active"}
                              </Badge>
                              <Badge variant="outline">
                                {link.clickCount} clicks
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                              Created: {formatDate(link.createdAt)}
                              {link.expiresAt &&
                                ` • Expires: ${formatDate(link.expiresAt)}`}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyLink(link.token)}
                            >
                              <Copy className="w-4 h-4" />
                              {copiedLink === link.token ? "Copied!" : "Copy"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevokeLink(link.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-3 p-2 bg-white rounded border border-slate-200">
                          <p className="text-xs text-slate-600 mb-1">
                            Full URL:
                          </p>
                          <p className="text-xs font-mono break-all text-blue-600">
                            {url}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export Tab */}
        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle>Export Enrollment Data</CardTitle>
              <p className="text-sm text-slate-600 mt-2">
                Download enrollment forms as Excel spreadsheet
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong>Batch:</strong> {currentBatch?.name}
                  </p>
                  <p className="text-sm text-blue-900 mt-1">
                    <strong>Forms to export:</strong> {batchForms.length}
                  </p>
                </div>

                <Button
                  onClick={handleExportExcel}
                  disabled={batchForms.length === 0}
                  className="w-full gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download as Excel (.xlsx)
                </Button>

                {batchForms.length === 0 && (
                  <p className="text-sm text-slate-500 text-center">
                    No forms to export for this batch
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ENROLLMENT FORM PREVIEW COMPONENT
// ─────────────────────────────────────────────────────────────
function EnrollmentFormPreview({ form }: { form: EnrollmentForm }) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="font-semibold text-slate-800 mb-2">Personal Details</h3>
        <div className="grid gap-2 text-slate-700">
          <p>
            <strong>Name:</strong> {form.personalDetails.studentName}
          </p>
          <p>
            <strong>Email:</strong> {form.personalDetails.email}
          </p>
          <p>
            <strong>Mobile:</strong> {form.personalDetails.mobileNo}
          </p>
          <p>
            <strong>Gender:</strong> {form.personalDetails.gender}
          </p>
          <p>
            <strong>Caste:</strong> {form.personalDetails.caste}
          </p>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-slate-800 mb-2">Address</h3>
        <div className="grid gap-2 text-slate-700">
          <p>
            {form.addressDetails.doorNo},{form.addressDetails.streetNagar}
          </p>
          <p>
            {form.addressDetails.district}, {form.addressDetails.state}{" "}
            {form.addressDetails.pincode}
          </p>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-slate-800 mb-2">Batch Details</h3>
        <div className="grid gap-2 text-slate-700">
          <p>
            <strong>Batch:</strong> {form.batchDetails.batchName}
          </p>
          <p>
            <strong>Duration:</strong> {form.batchDetails.batchDurationStart} to{" "}
            {form.batchDetails.batchDurationEnd}
          </p>
          <p>
            <strong>Payment Mode:</strong> {form.batchDetails.modeOfTransaction}
          </p>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-slate-800 mb-2">
          Terms & Conditions
        </h3>
        <div className="grid gap-1 text-slate-700">
          <p>
            ✓ All{" "}
            {Object.values(form.termsAndConditions).filter(Boolean).length} /5
            terms agreed
          </p>
        </div>
      </div>
    </div>
  );
}
