import { useState } from "react";
import { useData } from "../../context/DataContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import type { Batch } from "../../context/DataContext";

type BatchFormData = {
  name: string;
  description: string;
  schedule: string;
  subjects: string;
};

const emptyFormData: BatchFormData = {
  name: "",
  description: "",
  schedule: "",
  subjects: "",
};

function parseSubjects(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((subject) => subject.trim())
        .filter(Boolean),
    ),
  );
}

export default function BatchManagement() {
  const { batches, addBatch, updateBatch, deleteBatch, getStudentsByBatch } =
    useData();
  const [isOpen, setIsOpen] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<BatchFormData>(emptyFormData);

  const editingBatch = editingBatchId
    ? batches.find((batch) => batch.id === editingBatchId)
    : null;
  const currentSubjects = parseSubjects(formData.subjects);

  const resetForm = () => {
    setFormData(emptyFormData);
    setEditingBatchId(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsOpen(true);
  };

  const openEditDialog = (batch: Batch) => {
    setEditingBatchId(batch.id);
    setFormData({
      name: batch.name || "",
      description: batch.description || "",
      schedule: batch.schedule || "",
      subjects: (batch.subjects || []).join(", "),
    });
    setIsOpen(true);
  };

  const removeSubjectFromForm = (subjectToRemove: string) => {
    const nextSubjects = currentSubjects.filter((subject) => subject !== subjectToRemove);
    setFormData((prev) => ({ ...prev, subjects: nextSubjects.join(", ") }));
  };

  const handleSaveBatch = async () => {
    if (!formData.name.trim()) {
      alert("Batch name is required");
      return;
    }

    const subjects = parseSubjects(formData.subjects);

    if (subjects.length === 0) {
      alert("At least one subject is required");
      return;
    }

    try {
      const batchData: Partial<Batch> = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        schedule: formData.schedule.trim(),
        subjects,
      };

      if (editingBatchId) {
        await updateBatch(editingBatchId, batchData);
      } else {
        await addBatch(batchData as Omit<Batch, "id" | "createdDate" | "studentCount">);
      }

      resetForm();
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to save batch:", error);
      alert("Failed to save batch. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Dialog
          open={isOpen}
          onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openCreateDialog}>
              <Plus className="w-5 h-5" />
              Create Batch
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingBatch ? "Edit Batch" : "Create New Batch"}</DialogTitle>
              <DialogDescription>
                {editingBatch
                  ? "Update batch details and add or remove subjects."
                  : "Add a new batch (batch name and subjects are required)"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Batch Name
                </label>
                <Input
                  placeholder="e.g., Morning Batch, Evening Batch"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Schedule{" "}
                  <span className="text-xs text-slate-500">(optional)</span>
                </label>
                <Input
                  placeholder="e.g., Monday-Friday, 6:00 AM - 12:00 PM"
                  value={formData.schedule}
                  onChange={(e) =>
                    setFormData({ ...formData, schedule: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Description{" "}
                  <span className="text-xs text-slate-500">(optional)</span>
                </label>
                <Textarea
                  placeholder="Enter batch description..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Subjects
                </label>
                <Input
                  placeholder="e.g., Physics, Chemistry, Mathematics"
                  value={formData.subjects}
                  onChange={(e) =>
                    setFormData({ ...formData, subjects: e.target.value })
                  }
                />
                <p className="text-xs text-slate-500 mt-1">
                  Add or remove subjects separated by commas. Example: Physics, Chemistry, Maths
                </p>
                {currentSubjects.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {currentSubjects.map((subject) => (
                      <span
                        key={subject}
                        className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                      >
                        {subject}
                        <button
                          type="button"
                          onClick={() => removeSubjectFromForm(subject)}
                          className="ml-1 rounded-full px-1 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-800"
                          aria-label={`Remove ${subject}`}
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={handleSaveBatch} className="w-full">
                {editingBatch ? "Save Changes" : "Create Batch"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Batches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {batches.map((batch) => {
          const batchStudents = getStudentsByBatch(batch.id);
          return (
            <Card
              key={batch.id}
              className="border-slate-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{batch.name}</CardTitle>
                    <p className="text-sm text-slate-600 mt-1">
                      {batch.schedule}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditDialog(batch)}
                      className="text-slate-500 hover:text-indigo-700 p-1"
                      title="Edit batch"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <AlertDialog
                      open={deleteId === batch.id}
                      onOpenChange={(open) => !open && setDeleteId(null)}
                    >
                      <button
                        onClick={() => setDeleteId(batch.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Delete batch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Batch</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this batch? Students
                            will be unassigned but not deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="flex gap-3 justify-end">
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              deleteBatch(batch.id);
                              setDeleteId(null);
                            }}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Delete
                          </AlertDialogAction>
                        </div>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700 mb-4">
                  {batch.description}
                </p>
                <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg">
                  <Users className="w-5 h-5 text-indigo-600" />
                  <div>
                    <p className="text-sm text-slate-600">Enrolled Students</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {batchStudents.length}
                    </p>
                  </div>
                </div>
                {!!batch.subjects?.length && (
                  <div className="mt-4">
                    <p className="text-sm text-slate-600 mb-2">Subjects</p>
                    <div className="flex flex-wrap gap-2">
                      {batch.subjects.map((subject) => (
                        <span
                          key={subject}
                          className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                        >
                          {subject}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {batches.length === 0 && (
        <Card className="border-dashed border-2 border-slate-300">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-slate-400 mb-4">
              <Users className="w-12 h-12" />
            </div>
            <h3 className="text-lg font-medium text-slate-600">
              No batches yet
            </h3>
            <p className="text-slate-500 mt-1">
              Create your first batch to get started
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
