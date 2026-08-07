import React, { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
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
  ChevronRight,
  ArrowLeft,
  PlusCircle,
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
  description?: string;
  end?: boolean;
};

type PrimaryCategory = {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  to?: string;
  items?: SubItem[];
};

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const isCohost = user?.adminKind === "cohost";

  // Drill-down Category Definitions
  const adminCategories: PrimaryCategory[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      description: "Overview metrics & quick stats",
      icon: LayoutDashboard,
      to: "/admin",
    },
    {
      id: "live_classes",
      label: "Live Video Classes",
      description: "Zoom platform, co-hosts & links",
      icon: Video,
      items: [
        {
          to: "/admin/live-classes",
          icon: Video,
          label: "Video Classes Suite",
          description: "Subject-wise links, meeting studio & radar",
          end: true,
        },
        {
          to: "/admin/co-hosts",
          icon: UserPlus,
          label: "Co-Host Management",
          description: "Manage co-host accounts & passwords",
          end: true,
        },
        {
          to: "/admin/live-tests",
          icon: Radio,
          label: "Conduct Live Test",
          description: "Trigger live exams during active classes",
          end: true,
        },
      ],
    },
    {
      id: "tests",
      label: "Tests & Exam Engine",
      description: "CBT tests, live monitor & reports",
      icon: ClipboardList,
      items: [
        {
          to: "/admin/tests",
          icon: ClipboardList,
          label: "All Tests & Exams",
          description: "Manage CBT exams & question banks",
          end: true,
        },
        {
          to: "/admin/tests/create",
          icon: PlusCircle,
          label: "Create New Test",
          description: "Build new exam paper with questions",
          end: true,
        },
        {
          to: "/admin/tests/live-monitor",
          icon: Radio,
          label: "Live Exam Monitor",
          description: "Real-time student progress tracking",
          end: true,
        },
        {
          to: "/admin/tests/analytics",
          icon: BarChart3,
          label: "Analytics & Results",
          description: "Scorecards, ranks & test performance",
          end: true,
        },
        {
          to: "/admin/reports/student-tests",
          icon: FileSpreadsheet,
          label: "Student Test Reports",
          description: "Export individual test report sheets",
          end: true,
        },
      ],
    },
    {
      id: "people",
      label: "Students & Batches",
      description: "Profiles, enrollments & batches",
      icon: Users,
      items: [
        {
          to: "/admin/students",
          icon: Users,
          label: "Student Management",
          description: "Student profiles, credentials & access",
          end: true,
        },
        {
          to: "/admin/batches",
          icon: Layers3,
          label: "Batch Management",
          description: "Course batches & subject mapping",
          end: true,
        },
        {
          to: "/admin/enrollments",
          icon: FileText,
          label: "Enrollment Requests",
          description: "Review and approve student course joins",
          end: true,
        },
        {
          to: "/admin/public-registrations",
          icon: Globe,
          label: "Public Registrations",
          description: "Web registration submissions & leads",
          end: true,
        },
      ],
    },
    {
      id: "media",
      label: "Media & Library",
      description: "PDFs, study notes & video lectures",
      icon: Upload,
      items: [
        {
          to: "/admin/media",
          icon: Upload,
          label: "Content Upload & Library",
          description: "Manage PDFs, docs & study material",
          end: true,
        },
      ],
    },
    {
      id: "settings",
      label: "Portal Settings",
      description: "System config & site preferences",
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

  // Active category state for Level 2 view
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Auto-detect active category based on current URL path
  useEffect(() => {
    const matched = categories.find((cat) =>
      cat.items?.some(
        (item) =>
          location.pathname === item.to ||
          (item.to !== "/admin" && location.pathname.startsWith(item.to)),
      ),
    );
    if (matched) {
      setActiveCategory(matched.id);
    } else {
      setActiveCategory(null);
    }
  }, [location.pathname]);

  const selectedCategoryObj = categories.find((c) => c.id === activeCategory);

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-950 text-white transition-all duration-300 lg:static",
          !isOpen && "-translate-x-full lg:translate-x-0",
        )}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-2 text-white hover:bg-slate-800 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Banner */}
        <div className="border-b border-white/5 p-3">
          <img
            src={bannerImage}
            alt="KASC"
            className="h-16 w-full rounded-lg bg-slate-900 object-contain"
          />
        </div>

        {/* Navigation Content Area */}
        <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
          {/* LEVEL 2: DRILL-DOWN SUB-OPTIONS VIEW */}
          {activeCategory && selectedCategoryObj && selectedCategoryObj.items ? (
            <div className="space-y-4">
              {/* Back Button to Level 1 */}
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className="group flex w-full items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-indigo-300 transition-all hover:bg-indigo-600 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                <span>Back to Main Categories</span>
              </button>

              {/* Active Category Header */}
              <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/60 to-slate-900/60 p-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
                    <selectedCategoryObj.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      {selectedCategoryObj.label}
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {selectedCategoryObj.items.length} sub-options available
                    </p>
                  </div>
                </div>
              </div>

              {/* Sub-Options List */}
              <div className="space-y-1.5">
                <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Category Options
                </p>
                {selectedCategoryObj.items.map((sub) => (
                  <NavLink
                    key={sub.to}
                    to={sub.to}
                    end={sub.end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        "group flex flex-col rounded-xl px-3 py-2.5 transition-all",
                        isActive
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40 ring-1 ring-indigo-400/30"
                          : "bg-white/[0.03] text-slate-300 hover:bg-white/10 hover:text-white",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 font-semibold text-sm">
                            <sub.icon
                              className={cn(
                                "h-4 w-4",
                                isActive ? "text-white" : "text-indigo-400 group-hover:text-white",
                              )}
                            />
                            <span>{sub.label}</span>
                          </div>
                          {isActive ? (
                            <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          ) : null}
                        </div>
                        {sub.description ? (
                          <p
                            className={cn(
                              "mt-1 text-[11px] leading-tight",
                              isActive ? "text-indigo-100" : "text-slate-500 group-hover:text-slate-400",
                            )}
                          >
                            {sub.description}
                          </p>
                        ) : null}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ) : (
            /* LEVEL 1: MAIN PRIMARY CATEGORIES MENU */
            <div className="space-y-3">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Primary Categories
              </p>
              <div className="space-y-2">
                {categories.map((cat) => {
                  const hasSubItems = Boolean(cat.items && cat.items.length > 0);
                  const isCategoryActive = cat.to
                    ? location.pathname === cat.to || (cat.to !== "/admin" && location.pathname.startsWith(cat.to))
                    : cat.items?.some(
                        (item) =>
                          location.pathname === item.to ||
                          (item.to !== "/admin" && location.pathname.startsWith(item.to)),
                      );

                  // Direct link items (Dashboard / Settings / Student routes)
                  if (!hasSubItems && cat.to) {
                    return (
                      <NavLink
                        key={cat.id}
                        to={cat.to}
                        end={cat.to === "/admin" || cat.to === "/student"}
                        onClick={onClose}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center justify-between rounded-xl px-3 py-3 text-sm transition-all",
                            isActive
                              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/30 font-semibold"
                              : "bg-white/[0.03] text-slate-300 hover:bg-white/10 hover:text-white font-medium",
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

                  // Primary Category Drill-Down Button
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        if (hasSubItems) {
                          setActiveCategory(cat.id);
                        } else if (cat.to) {
                          navigate(cat.to);
                          if (onClose) onClose();
                        }
                      }}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-xl p-3 text-left transition-all",
                        isCategoryActive
                          ? "bg-indigo-950/80 text-white ring-1 ring-indigo-500/40 shadow-md"
                          : "bg-white/[0.03] text-slate-200 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                            isCategoryActive
                              ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/40"
                              : "bg-white/5 text-slate-400 group-hover:bg-indigo-600/20 group-hover:text-indigo-300",
                          )}
                        >
                          <cat.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold">{cat.label}</div>
                          {cat.description ? (
                            <div className="text-[11px] text-slate-500 group-hover:text-slate-400">
                              {cat.description}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-slate-400 group-hover:text-white">
                        {cat.items ? (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                            {cat.items.length}
                          </span>
                        ) : null}
                        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        {/* User Footer */}
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
