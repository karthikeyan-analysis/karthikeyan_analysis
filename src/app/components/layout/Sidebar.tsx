import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router";
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
  ChevronDown,
  ChevronRight,
  PlusCircle,
  Award,
  Sparkles,
} from "lucide-react";
import { cn } from "../ui/utils";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

type SubItem = {
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
};

type PrimaryCategory = {
  id: string;
  label: string;
  icon: React.ElementType;
  to?: string;
  items?: SubItem[];
};

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === "admin";
  const isCohost = user?.adminKind === "cohost";

  // Categories definition for full Admin
  const adminCategories: PrimaryCategory[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      to: "/admin",
    },
    {
      id: "live_classes",
      label: "Live Video Classes",
      icon: Video,
      items: [
        { to: "/admin/live-classes", icon: Video, label: "Video Classes Suite", end: true },
        { to: "/admin/co-hosts", icon: UserPlus, label: "Co-Host Accounts", end: true },
        { to: "/admin/live-tests", icon: Radio, label: "Conduct Live Test", end: true },
      ],
    },
    {
      id: "tests",
      label: "Tests & Exam Engine",
      icon: ClipboardList,
      items: [
        { to: "/admin/tests", icon: ClipboardList, label: "All Tests & Exams", end: true },
        { to: "/admin/tests/create", icon: PlusCircle, label: "Create New Test", end: true },
        { to: "/admin/tests/live-monitor", icon: Radio, label: "Live Exam Monitor", end: true },
        { to: "/admin/tests/analytics", icon: BarChart3, label: "Analytics & Results", end: true },
        { to: "/admin/reports/student-tests", icon: FileSpreadsheet, label: "Student Test Reports", end: true },
      ],
    },
    {
      id: "people",
      label: "Students & Batches",
      icon: Users,
      items: [
        { to: "/admin/students", icon: Users, label: "Student Management", end: true },
        { to: "/admin/batches", icon: Layers3, label: "Batch Management", end: true },
        { to: "/admin/enrollments", icon: FileText, label: "Enrollment Requests", end: true },
        { to: "/admin/public-registrations", icon: Globe, label: "Public Registrations", end: true },
      ],
    },
    {
      id: "media",
      label: "Media & Library",
      icon: Upload,
      items: [
        { to: "/admin/media", icon: Upload, label: "Content Upload & Library", end: true },
      ],
    },
    {
      id: "settings",
      label: "Portal Settings",
      icon: Settings2,
      to: "/admin/portal-settings",
    },
  ];

  // Co-Host Categories
  const cohostCategories: PrimaryCategory[] = [
    {
      id: "cohost_live",
      label: "Live Classes Studio",
      icon: Video,
      items: [
        { to: "/admin/live-classes", icon: Video, label: "Live Classes Suite", end: true },
        { to: "/admin/live-tests", icon: Radio, label: "Conduct Live Test", end: true },
      ],
    },
  ];

  // Student Categories
  const studentCategories: PrimaryCategory[] = [
    { id: "s_dash", label: "Dashboard", icon: LayoutDashboard, to: "/student" },
    { id: "s_live", label: "Live Classes", icon: Video, to: "/student/live-classes" },
    { id: "s_media", label: "Media Library", icon: BookOpen, to: "/student/media" },
    { id: "s_tests", label: "Tests & Exams", icon: ClipboardList, to: "/student/tests" },
  ];

  const categories = isAdmin
    ? isCohost
      ? cohostCategories
      : adminCategories
    : studentCategories;

  // Track expanded categories in state
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  // Auto-expand the category containing the current active path
  useEffect(() => {
    const activeCat = categories.find((cat) =>
      cat.items?.some(
        (item) =>
          location.pathname === item.to ||
          (item.to !== "/admin" && location.pathname.startsWith(item.to)),
      ),
    );
    if (activeCat && !openCategories[activeCat.id]) {
      setOpenCategories((prev) => ({ ...prev, [activeCat.id]: true }));
    }
  }, [location.pathname, categories]);

  const toggleCategory = (id: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

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

        <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
          {categories.map((cat) => {
            const hasSubItems = Boolean(cat.items && cat.items.length > 0);
            const isExpanded = Boolean(openCategories[cat.id]);
            const isCategoryActive = cat.to
              ? location.pathname === cat.to || (cat.to !== "/admin" && location.pathname.startsWith(cat.to))
              : cat.items?.some(
                  (item) =>
                    location.pathname === item.to ||
                    (item.to !== "/admin" && location.pathname.startsWith(item.to)),
                );

            if (!hasSubItems && cat.to) {
              return (
                <NavLink
                  key={cat.id}
                  to={cat.to}
                  end={cat.to === "/admin" || cat.to === "/student"}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-all",
                      isActive
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/30 font-semibold"
                        : "text-slate-300 hover:bg-white/5 hover:text-white font-medium",
                    )
                  }
                >
                  {({ isActive }) => (
                    <div className="flex items-center gap-3">
                      <cat.icon className={cn("h-4 w-4", isActive ? "text-white" : "text-indigo-400")} />
                      <span>{cat.label}</span>
                    </div>
                  )}
                </NavLink>
              );
            }

            return (
              <div key={cat.id} className="rounded-xl bg-white/[0.02] ring-1 ring-white/5">
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-all",
                    isCategoryActive
                      ? "bg-indigo-950/80 text-indigo-300 ring-1 ring-indigo-500/30"
                      : "text-slate-200 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <cat.icon
                      className={cn(
                        "h-4 w-4",
                        isCategoryActive ? "text-indigo-400" : "text-slate-400",
                      )}
                    />
                    <span>{cat.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {cat.items ? (
                      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                        {cat.items.length}
                      </span>
                    ) : null}
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {isExpanded && cat.items ? (
                  <div className="space-y-1 pb-2 pt-1 pl-4 pr-1.5">
                    {cat.items.map((sub) => (
                      <NavLink
                        key={sub.to}
                        to={sub.to}
                        end={sub.end}
                        onClick={onClose}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-all",
                            isActive
                              ? "bg-indigo-600 text-white font-medium shadow-md"
                              : "text-slate-400 hover:bg-white/5 hover:text-slate-200 font-medium",
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <sub.icon
                              className={cn(
                                "h-3.5 w-3.5",
                                isActive ? "text-white" : "text-slate-400",
                              )}
                            />
                            <span className="truncate">{sub.label}</span>
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
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
