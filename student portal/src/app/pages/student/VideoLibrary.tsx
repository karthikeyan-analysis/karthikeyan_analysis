import { useState } from "react";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Play, Clock, Search } from "lucide-react";

export default function VideoLibrary() {
  const { videos, getVideosByBatch } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  // Get videos available to the current student's batch
  const availableVideos = user?.batchId
    ? getVideosByBatch(user.batchId)
    : videos.filter((video) => video.visibilityType === "ALL");

  const filteredVideos = availableVideos.filter(
    (video) =>
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Video Library</h1>
        <p className="text-slate-600 mt-1">Watch your secure course videos</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search videos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVideos.map((video) => (
          <div
            key={video.id}
            className="group cursor-pointer"
            onClick={() => navigate(`/student/video/${video.id}`)}
          >
            <div className="relative aspect-video rounded-lg overflow-hidden mb-3 bg-slate-900">
              <img
                src={video.thumbnail}
                alt={video.title}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <Play className="w-7 h-7 text-slate-900 ml-1" />
                </div>
              </div>
              <div className="absolute top-3 right-3">
                <Badge className="bg-black/70 text-white hover:bg-black/70">
                  <Clock className="w-3 h-3 mr-1" />
                  {video.duration}
                </Badge>
              </div>
              <div className="absolute bottom-3 left-3">
                <Badge className="bg-indigo-600 hover:bg-indigo-600">
                  Secure Stream
                </Badge>
              </div>
            </div>
            <h3 className="font-semibold text-lg text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">
              {video.title}
            </h3>
            <p className="text-sm text-slate-600 line-clamp-2 mb-2">
              {video.description}
            </p>
            <p className="text-xs text-slate-500">{video.uploadDate}</p>
          </div>
        ))}
      </div>

      {filteredVideos.length === 0 && (
        <div className="text-center py-12">
          <Play className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">
            No videos found
          </h3>
          <p className="text-slate-600">
            {searchQuery
              ? "Try adjusting your search query"
              : "No videos available at the moment"}
          </p>
        </div>
      )}
    </div>
  );
}
