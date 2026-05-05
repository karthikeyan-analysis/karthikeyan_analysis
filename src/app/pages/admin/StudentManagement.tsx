import { useState } from "react";
import { useData } from "../../context/DataContext";
import type { Student } from "../../context/DataContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Badge } from "../../components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { UserPlus, Pencil, Trash2, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

export default function StudentManagement() {
  const { students, batches, addStudent, updateStudent, deleteStudent } =
    useData();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBatch, setSelectedBatch] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    studentId: "",
    name: "",
    email: "",
    status: "active" as "active" | "inactive",
    batchId: "",
  });

  // Filter students by selected batch
  const batchFilteredStudents =
    selectedBatch === "all"
      ? students
      : students.filter((student) => student.batchId === selectedBatch);

  // Then filter by search query
  const filteredStudents = batchFilteredStudents.filter(
    (student) =>
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.studentId.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (editingStudent) {
        await updateStudent(editingStudent.id, formData);
        setEditingStudent(null);
      } else {
        await addStudent({
          ...formData,
          enrolledDate: new Date().toISOString().split("T")[0],
        });
        setIsAddDialogOpen(false);
      }

      setFormData({
        studentId: "",
        name: "",
        email: "",
        status: "active",
        batchId: "",
      });
    } catch (err: any) {
      setError(err?.message || "Failed to save student");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      studentId: student.studentId,
      name: student.name,
      email: student.email,
      status: student.status,
      batchId: student.batchId || "",
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this student?")) {
      setIsLoading(true);
      setError("");
      try {
        await deleteStudent(id);
      } catch (err: any) {
        setError(err?.message || "Failed to delete student");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      studentId: "",
      name: "",
      email: "",
      status: "active",
      batchId: "",
    });
    setEditingStudent(null);
    setError("");
  };

  const getBatchName = (batchId?: string) => {
    if (!batchId) return "Not Assigned";
    return batches.find((b) => b.id === batchId)?.name || "Unknown";
  };

  const getStudentCountByBatch = (batchId: string) => {
    return students.filter((s) => s.batchId === batchId).length;
  };

  const getUnassignedStudentCount = () => {
    return students.filter((s) => !s.batchId).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <UserPlus className="w-4 h-4 mr-2" />
              Add Student
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingStudent ? "Edit Student" : "Enroll New Student"}
              </DialogTitle>
              <DialogDescription>
                {editingStudent
                  ? "Update student information"
                  : "Add a new student to the portal"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="studentId">Student ID</Label>
                  <Input
                    id="studentId"
                    placeholder="STU2024XXX"
                    value={formData.studentId}
                    onChange={(e) =>
                      setFormData({ ...formData, studentId: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="student@edu.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batch">Batch</Label>
                  <Select
                    value={formData.batchId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, batchId: value })
                    }
                  >
                    <SelectTrigger id="batch">
                      <SelectValue placeholder="Select a batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {batches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        status: value as "active" | "inactive",
                      })
                    }
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    resetForm();
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700"
                  disabled={isLoading}
                >
                  {isLoading
                    ? "Saving..."
                    : editingStudent
                      ? "Update Student"
                      : "Add Student"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Batch Tabs - Horizontal at Top */}
      <div className="border-b border-slate-200 bg-white rounded-lg">
        <Tabs
          value={selectedBatch}
          onValueChange={setSelectedBatch}
          className="w-full"
        >
          <div className="flex items-center justify-between px-6 pt-4">
            <TabsList className="flex gap-1 bg-transparent p-0 h-auto">
              {/* All Students Tab */}
              <TabsTrigger
                value="all"
                className="px-4 py-2 rounded-t-lg data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 bg-slate-100"
              >
                <div className="text-center">
                  <div className="font-medium text-sm">All Students</div>
                  <div className="text-xs text-slate-500">
                    {students.length}
                  </div>
                </div>
              </TabsTrigger>

              {/* Individual Batch Tabs */}
              {batches.map((batch) => {
                const studentCount = getStudentCountByBatch(batch.id);
                return (
                  <TabsTrigger
                    key={batch.id}
                    value={batch.id}
                    className="px-4 py-2 rounded-t-lg data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 bg-slate-100"
                  >
                    <div className="text-center">
                      <div className="font-medium text-sm truncate">
                        {batch.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {studentCount}
                      </div>
                    </div>
                  </TabsTrigger>
                );
              })}

              {/* Unassigned Students Tab */}
              {getUnassignedStudentCount() > 0 && (
                <TabsTrigger
                  value="unassigned"
                  className="px-4 py-2 rounded-t-lg data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 bg-slate-100"
                >
                  <div className="text-center">
                    <div className="font-medium text-sm">Not Assigned</div>
                    <div className="text-xs text-slate-500">
                      {getUnassignedStudentCount()}
                    </div>
                  </div>
                </TabsTrigger>
              )}
            </TabsList>

            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* All Students Content */}
          <TabsContent value="all" className="px-6 pb-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Enrolled Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((student) => (
                      <StudentRow
                        key={student.id}
                        student={student}
                        editingStudent={editingStudent}
                        formData={formData}
                        setFormData={setFormData}
                        batches={batches}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onSubmit={handleSubmit}
                        onReset={resetForm}
                        getBatchName={getBatchName}
                      />
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <p className="text-slate-500">No students found</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Individual Batch Content */}
          {batches.map((batch) => (
            <TabsContent key={batch.id} value={batch.id} className="px-6 pb-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Enrolled Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map((student) => (
                        <StudentRow
                          key={student.id}
                          student={student}
                          editingStudent={editingStudent}
                          formData={formData}
                          setFormData={setFormData}
                          batches={batches}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          onSubmit={handleSubmit}
                          onReset={resetForm}
                          getBatchName={getBatchName}
                          showBatchColumn={false}
                        />
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <p className="text-slate-500">
                            No students in this batch
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          ))}

          {/* Unassigned Students Content */}
          {getUnassignedStudentCount() > 0 && (
            <TabsContent value="unassigned" className="px-6 pb-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Enrolled Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map((student) => (
                        <StudentRow
                          key={student.id}
                          student={student}
                          editingStudent={editingStudent}
                          formData={formData}
                          setFormData={setFormData}
                          batches={batches}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          onSubmit={handleSubmit}
                          onReset={resetForm}
                          getBatchName={getBatchName}
                          showBatchColumn={false}
                        />
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <p className="text-slate-500">
                            No unassigned students
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

// Student Row Component
interface StudentRowProps {
  student: Student;
  editingStudent: Student | null;
  formData: any;
  setFormData: any;
  batches: any[];
  onEdit: (student: Student) => void;
  onDelete: (id: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  getBatchName: (batchId?: string) => string;
  showBatchColumn?: boolean;
}

function StudentRow({
  student,
  editingStudent,
  formData,
  setFormData,
  batches,
  onEdit,
  onDelete,
  onSubmit,
  onReset,
  getBatchName,
  showBatchColumn = true,
}: StudentRowProps) {
  return (
    <TableRow key={student.id}>
      <TableCell className="font-medium">{student.studentId}</TableCell>
      <TableCell>{student.name}</TableCell>
      <TableCell>{student.email}</TableCell>
      {showBatchColumn && (
        <TableCell className="text-sm text-slate-600">
          {getBatchName(student.batchId)}
        </TableCell>
      )}
      <TableCell>{student.enrolledDate}</TableCell>
      <TableCell>
        <Badge
          variant={student.status === "active" ? "default" : "secondary"}
          className={
            student.status === "active"
              ? "bg-green-100 text-green-800 hover:bg-green-100"
              : ""
          }
        >
          {student.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Dialog
            open={editingStudent?.id === student.id}
            onOpenChange={(open) => !open && onReset()}
          >
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(student)}
              >
                <Pencil className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Student</DialogTitle>
                <DialogDescription>
                  Update student information
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={onSubmit}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-studentId">Student ID</Label>
                    <Input
                      id="edit-studentId"
                      value={formData.studentId}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          studentId: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Full Name</Label>
                    <Input
                      id="edit-name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          name: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email Address</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          email: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-batch">Batch</Label>
                    <Select
                      value={formData.batchId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, batchId: value })
                      }
                    >
                      <SelectTrigger id="edit-batch">
                        <SelectValue placeholder="Select a batch" />
                      </SelectTrigger>
                      <SelectContent>
                        {batches.map((batch) => (
                          <SelectItem key={batch.id} value={batch.id}>
                            {batch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          status: value as "active" | "inactive",
                        })
                      }
                    >
                      <SelectTrigger id="edit-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={onReset}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(student.id)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
