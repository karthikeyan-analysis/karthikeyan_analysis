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
import { Plus, Trash2, Users } from "lucide-react";

export default function BatchManagement() {
  const { batches, addBatch, updateBatch, deleteBatch, getStudentsByBatch } =
    useData();
  const [isOpen, setIsOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    schedule: "",
    subjects: "",
  });

  const handleAddBatch = async () => {
    if (!formData.name.trim()) {
      alert("Batch name is required");
      return;
    }

    const subjects = formData.subjects
      .split(",")
      .map((subject) => subject.trim())
      .filter(Boolean);

    if (subjects.length === 0) {
      alert("At least one subject is required");
      return;
    }

    try {
      const batchData: any = {
        name: formData.name.trim(),
        subjects: subjects, // Always include subjects (required)
      };

      // Only add optional fields if they have values
      if (formData.description.trim()) {
        batchData.description = formData.description.trim();
      }

      if (formData.schedule.trim()) {
        batchData.schedule = formData.schedule.trim();
      }

      await addBatch(batchData);
      setFormData({ name: "", description: "", schedule: "", subjects: "" });
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to create batch:", error);
      alert("Failed to create batch. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-5 h-5" />
              Create Batch
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Batch</DialogTitle>
              <DialogDescription>
                Add a new batch (batch name and subjects are required)
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
                  Add multiple subjects separated by commas
                </p>
              </div>
              <Button onClick={handleAddBatch} className="w-full">
                Create Batch
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
                  <AlertDialog
                    open={deleteId === batch.id}
                    onOpenChange={(open) => !open && setDeleteId(null)}
                  >
                    <button
                      onClick={() => setDeleteId(batch.id)}
                      className="text-red-500 hover:text-red-700 p-1"
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
