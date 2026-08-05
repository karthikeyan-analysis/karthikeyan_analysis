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
  Radio,
  FileText,
  Globe,
  Settings2,
  Video,
  UserPlus,
  Layers3,
} from "lucide-react";
import { cn } from "../ui/utils";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

type NavItem = {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  end?: boolean;
};

type NavGroup = {
  label?: string;
  items: NavItem[];
};

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isCohost = user?.adminKind === "cohost";

  const fullAdminGroups: NavGroup[] = [
    {
      items: [{ to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true }],
    },
    {
      label: "People",
      items: [
        { to: "/admin/batches", icon: Layers3, label: "Batches", end: true },
        { to: "/admin/students", icon: Users, label: "Students", end: true },
        { to: "/admin/enrollments", icon: FileText, label: "Enrollments", end: true },
        { to: "/admin/co-hosts", icon: UserPlus, label: "Co-Hosts", end: true },
      ],
    },
    {
      label: "Learning",
      items: [
        { to: "/admin/live-classes", icon: Video, label: "Live Classes", end: true },
        { to: "/admin/live-tests", icon: Radio, label: "Conduct Live Test", end: true },
        { to: "/admin/media", icon: Upload, label: "Media", end: true },
        { to: "/admin/tests", icon: ClipboardList, label: "Tests", end: true },
      ],
    },
    {
      label: "Insights",
      items: [
        { to: "/admin/tests/live-monitor", icon: Radio, label: "Live monitor", end: true },
        { to: "/admin/tests/analytics", icon: BarChart3, label: "Analytics", end: true },
        {
          to: "/admin/reports/student-tests",
          icon: FileSpreadsheet,
          label: "Test reports",
          end: true,
        },
      ],
    },
    {
      label: "System",
      items: [
        {
          to: "/admin/public-registrations",
          icon: Globe,
          label: "Public registrations",
          end: true,
        },
        { to: "/admin/portal-settings", icon: Settings2, label: "Settings", end: true },
      ],
    },
  ];

  const cohostGroups: NavGroup[] = [
    {
      items: [
        { to: "/admin/live-classes", icon: Video, label: "Live Classes", end: true },
        { to: "/admin/live-tests", icon: Radio, label: "Conduct Live Test", end: true },
      ],
    },
  ];

  const studentGroups: NavGroup[] = [
    {
      items: [
        { to: "/student", icon: LayoutDashboard, label: "Dashboard", end: true },
        { to: "/student/live-classes", icon: Video, label: "Live Classes", end: true },
        { to: "/student/media", icon: BookOpen, label: "Media Library", end: true },
        { to: "/student/tests", icon: ClipboardList, label: "Tests", end: true },
      ],
    },
  ];

  const groups = isAdmin ? (isCohost ? cohostGroups : fullAdminGroups) : studentGroups;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-950 text-white transition-transform duration-300 lg:static",
          !isOpen && "-translate-x-full lg:translate-x-0",
        )}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-2 text-white hover:bg-slate-800 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="border-b border-white/5 p-3">
          <img
            src={bannerImage}
            alt="KASC"
            className="h-16 w-full rounded-lg bg-slate-900 object-contain"
          />
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groups.map((group, gi) => (
            <div key={group.label || `g-${gi}`} className="space-y-1">
              {group.label ? (
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {group.label}
                </p>
              ) : null}
              {group.items.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end ?? link.to.split("/").length === 2}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                      isActive
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/30"
                        : "text-slate-300 hover:bg-white/5 hover:text-white",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <link.icon
                        className={cn("h-4 w-4", isActive ? "text-white" : "text-slate-400")}
                      />
                      <span className="font-medium">{link.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/5 p-3">
          <div className="rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/5">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Signed in</p>
            <p className="mt-0.5 truncate text-sm font-medium text-slate-100" title={user?.email}>
              {user?.name || user?.email}
            </p>
            {user?.email && user?.name ? (
              <p className="truncate text-xs text-slate-500" title={user.email}>
                {user.email}
              </p>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );
}
