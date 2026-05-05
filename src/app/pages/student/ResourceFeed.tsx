import { useState } from "react";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { FileText, Download, Search, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

export default function ResourceFeed() {
  const { content, getContentByBatch } = useData();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  // Get content available to the current student's batch
  const availableContent = user?.batchId
    ? getContentByBatch(user.batchId)
    : content.filter((item) => item.visibilityType === "ALL");

  const filteredContent = availableContent.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || item.type === filterType;
    return matchesSearch && matchesType;
  });

  const getTypeColor = (type: string) => {
    switch (type) {
      case "pdf":
        return "bg-red-100 text-red-800";
      case "doc":
        return "bg-blue-100 text-blue-800";
      case "note":
        return "bg-green-100 text-green-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Resource Feed</h1>
        <p className="text-slate-600 mt-1">
          Access your course materials and notes
        </p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="pdf">PDF Documents</SelectItem>
            <SelectItem value="doc">Word Documents</SelectItem>
            <SelectItem value="note">Course Notes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredContent.map((item) => (
          <Card
            key={item.id}
            className="border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all cursor-pointer group"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                  <FileText className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" />
                </div>
                <Badge className={getTypeColor(item.type)}>
                  {item.type.toUpperCase()}
                </Badge>
              </div>

              <h3 className="font-semibold text-lg text-slate-900 mb-2 line-clamp-2">
                {item.title}
              </h3>

              <p className="text-sm text-slate-600 mb-4 line-clamp-3">
                {item.description}
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <span className="text-xs text-slate-500">
                  {item.uploadDate}
                </span>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                  <Download className="w-3 h-3 mr-1" />
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredContent.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">
            No resources found
          </h3>
          <p className="text-slate-600">
            {searchQuery || filterType !== "all"
              ? "Try adjusting your search or filters"
              : "No resources available at the moment"}
          </p>
        </div>
      )}
    </div>
  );
}
