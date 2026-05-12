import React from "react";
import { NavLink } from "react-router";
import { useAuth } from "../../context/AuthContext";
import bannerImage from "../../../banner.jpeg";
import {
  LayoutDashboard,
  Users,
  Upload,
  BookOpen,
  X,
  ClipboardList,
  BarChart3,
  FileSpreadsheet,
} from "lucide-react";
import { cn } from "../ui/utils";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const adminLinks: {
    to: string;
    icon: typeof LayoutDashboard;
    label: string;
    end?: boolean;
  }[] = [
    { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
    { to: "/admin/batches", icon: Users, label: "Batch Management", end: true },
    { to: "/admin/students", icon: Users, label: "Students", end: true },
    { to: "/admin/media", icon: Upload, label: "Media Manager", end: true },
    { to: "/admin/tests", icon: ClipboardList, label: "Test Management", end: true },
    { to: "/admin/tests/analytics", icon: BarChart3, label: "Test analytics", end: true },
    { to: "/admin/reports/student-tests", icon: FileSpreadsheet, label: "Student test reports", end: true },
  ];

  const studentLinks = [
    { to: "/student", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/student/media", icon: BookOpen, label: "Media Library" },
    { to: "/student/tests", icon: ClipboardList, label: "Tests" },
  ];

  const links = isAdmin ? adminLinks : studentLinks;

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col transition-transform duration-300",
          !isOpen && "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Close button for mobile */}
        <button
          onClick={onClose}
          className="lg:hidden absolute top-4 right-4 p-2 text-white hover:bg-slate-800 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Banner */}
        <div className="border-b border-slate-800 p-3">
          <img
            src={bannerImage}
            alt="EduHub banner"
            className="h-20 w-full rounded-md bg-slate-900 object-contain"
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end ?? link.to.split("/").length === 2}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
                  isActive
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <link.icon
                    className={cn("w-5 h-5", isActive && "text-white")}
                  />
                  <span>{link.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800">
          <div className="px-4 py-2 bg-slate-800 rounded-lg">
            <p className="text-xs text-slate-400">Logged in as</p>
            <p className="text-sm font-medium truncate">{user?.email}</p>
          </div>
        </div>
      </aside>
    </>
  );
}
