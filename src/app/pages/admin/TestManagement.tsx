import { useState } from "react";
import { useData } from "../../context/DataContext";
import type { Test } from "../../context/DataContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Plus, Trash2, Edit2, Calendar } from "lucide-react";

export default function TestManagement() {
  const { batches, tests, addTest, updateTest, deleteTest, getTestsByBatch } =
    useData();
  const [selectedBatch, setSelectedBatch] = useState<string>(
    batches[0]?.id || "",
  );
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<Test | null>(null);

  const [formData, setFormData] = useState({
    testNo: "",
    testDate: "",
    portion: "",
    startTime: "",
    endTime: "",
    cbtLink: "",
    status: "upcoming" as "closed" | "active" | "upcoming",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBatch || !formData.testNo || !formData.testDate) {
      alert("Please fill all required fields");
      return;
    }

    if (editingTest) {
      updateTest(editingTest.id, {
        ...formData,
        testNo: parseInt(formData.testNo),
      } as Partial<Test>);
      setEditingTest(null);
    } else {
      addTest({
        testNo: parseInt(formData.testNo),
        testDate: formData.testDate,
        portion: formData.portion,
        startTime: formData.startTime,
        endTime: formData.endTime,
        cbtLink: formData.cbtLink,
        status: formData.status,
        batchId: selectedBatch,
      });
    }

    resetForm();
    setIsAddDialogOpen(false);
  };

  const resetForm = () => {
    setFormData({
      testNo: "",
      testDate: "",
      portion: "",
      startTime: "",
      endTime: "",
      cbtLink: "",
      status: "upcoming",
    });
    setEditingTest(null);
  };

  const handleEdit = (test: Test) => {
    setEditingTest(test);
    setFormData({
      testNo: test.testNo.toString(),
      testDate: test.testDate,
      portion: test.portion,
      startTime: test.startTime,
      endTime: test.endTime,
      cbtLink: test.cbtLink,
      status: test.status,
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this test?")) {
      deleteTest(id);
    }
  };

  const batchTests = selectedBatch ? getTestsByBatch(selectedBatch) : [];
  const currentBatch = batches.find((b) => b.id === selectedBatch);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "closed":
        return "bg-gray-100 text-gray-800";
      case "upcoming":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            Test Management
          </h1>
          <p className="text-slate-600 mt-1">
            Create and manage CBT tests for your batches
          </p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Test
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingTest ? "Edit Test" : "Add New Test"}
              </DialogTitle>
              <DialogDescription>
                {editingTest
                  ? "Update test details"
                  : "Create a new CBT test for your batch"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="batch">Select Batch *</Label>
                  <Select
                    value={selectedBatch}
                    onValueChange={setSelectedBatch}
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
                  <Label htmlFor="testNo">Test No *</Label>
                  <Input
                    id="testNo"
                    type="number"
                    placeholder="1"
                    value={formData.testNo}
                    onChange={(e) =>
                      setFormData({ ...formData, testNo: e.target.value })
                    }
                    required
                    min="1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="testDate">Test Date (DD.MM.YY) *</Label>
                  <Input
                    id="testDate"
                    placeholder="28.02.26"
                    value={formData.testDate}
                    onChange={(e) =>
                      setFormData({ ...formData, testDate: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="portion">Test Portion/Unit *</Label>
                  <Input
                    id="portion"
                    placeholder="Unit-1 Descriptive Statistics"
                    value={formData.portion}
                    onChange={(e) =>
                      setFormData({ ...formData, portion: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time *</Label>
                  <Input
                    id="startTime"
                    placeholder="6:00 AM"
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData({ ...formData, startTime: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time *</Label>
                  <Input
                    id="endTime"
                    placeholder="7:30 AM"
                    value={formData.endTime}
                    onChange={(e) =>
                      setFormData({ ...formData, endTime: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="cbtLink">CBT Link *</Label>
                  <Input
                    id="cbtLink"
                    type="url"
                    placeholder="https://exam.example.com/test1"
                    value={formData.cbtLink}
                    onChange={(e) =>
                      setFormData({ ...formData, cbtLink: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        status: value as "closed" | "active" | "upcoming",
                      })
                    }
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="active">Active (START NOW)</SelectItem>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {editingTest ? "Update Test" : "Add Test"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Batch Selection */}
      <div className="space-y-2">
        <Label htmlFor="batch-select">Select Batch</Label>
        <Select value={selectedBatch} onValueChange={setSelectedBatch}>
          <SelectTrigger id="batch-select">
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

      {/* Batch Info */}
      {currentBatch && (
        <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200">
          <CardHeader>
            <CardTitle className="text-indigo-900">
              {currentBatch.name} - Tests
            </CardTitle>
            <p className="text-sm text-indigo-800 mt-2">
              Total Tests:{" "}
              <span className="font-semibold">{batchTests.length}</span>
            </p>
          </CardHeader>
        </Card>
      )}

      {/* Tests Table */}
      {batchTests.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Test Portion</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>CBT Link</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchTests.map((test) => (
                    <TableRow key={test.id}>
                      <TableCell className="font-medium">
                        {test.testNo}
                      </TableCell>
                      <TableCell className="text-sm">{test.testDate}</TableCell>
                      <TableCell className="text-sm">{test.portion}</TableCell>
                      <TableCell className="text-sm">
                        {test.startTime} – {test.endTime}
                      </TableCell>
                      <TableCell>
                        <a
                          href={test.cbtLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-700 text-sm truncate max-w-xs"
                        >
                          {test.cbtLink.substring(0, 30)}...
                        </a>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(test.status)}>
                          {test.status === "active" ? "START NOW" : test.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(test)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(test.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-8 text-center pb-8">
            <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-600 font-medium">No Tests Yet</p>
            <p className="text-sm text-slate-500 mt-1">
              Create your first test to get started
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
