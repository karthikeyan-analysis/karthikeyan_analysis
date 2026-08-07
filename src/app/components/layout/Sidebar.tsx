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
  Shield,
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
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const isCohost = user?.adminKind === "cohost";

  // Drill-down Category Definitions
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
        {
          to: "/admin/live-classes",
          icon: Video,
          label: "Video Classes Suite",
          end: true,
        },
        {
          to: "/admin/co-hosts",
          icon: UserPlus,
          label: "Co-Host Management",
          end: true,
        },
        {
          to: "/admin/live-tests",
          icon: Radio,
          label: "Conduct Live Test",
          end: true,
        },
      ],
    },
    {
      id: "tests",
      label: "Tests & Exam Engine",
      icon: ClipboardList,
      items: [
        {
          to: "/admin/tests",
          icon: ClipboardList,
          label: "All Tests & Exams",
          end: true,
        },
        {
          to: "/admin/tests/create",
          icon: PlusCircle,
          label: "Create New Test",
          end: true,
        },
        {
          to: "/admin/tests/live-monitor",
          icon: Radio,
          label: "Live Exam Monitor",
          end: true,
        },
        {
          to: "/admin/tests/analytics",
          icon: BarChart3,
          label: "Analytics & Results",
          end: true,
        },
        {
          to: "/admin/reports/student-tests",
          icon: FileSpreadsheet,
          label: "Student Test Reports",
          end: true,
        },
      ],
    },
    {
      id: "people",
      label: "Students & Batches",
      icon: Users,
      items: [
        {
          to: "/admin/students",
          icon: Users,
          label: "Student Management",
          end: true,
        },
        {
          to: "/admin/batches",
          icon: Layers3,
          label: "Batch Management",
          end: true,
        },
        {
          to: "/admin/enrollments",
          icon: FileText,
          label: "Enrollment Requests",
          end: true,
        },
        {
          to: "/admin/public-registrations",
          icon: Globe,
          label: "Public Registrations",
          end: true,
        },
      ],
    },
    {
      id: "media",
      label: "Media & Library",
      icon: Upload,
      items: [
        {
          to: "/admin/media",
          icon: Upload,
          label: "Content Upload & Library",
          end: true,
        },
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
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-950 text-white shadow-2xl transition-all duration-300 border-r border-white/10 lg:static",
          !isOpen && "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Mobile Close Button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Logo Banner */}
        <div className="border-b border-white/10 p-3 bg-slate-900/50">
          <img
            src={bannerImage}
            alt="KASC Study Circle"
            className="h-14 w-full rounded-xl bg-slate-900 object-contain p-1 shadow-inner"
          />
        </div>

        {/* Navigation Content Area */}
        <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-4 scrollbar-thin scrollbar-thumb-slate-800">
          {/* LEVEL 2: DRILL-DOWN SUB-OPTIONS VIEW */}
          {activeCategory && selectedCategoryObj && selectedCategoryObj.items ? (
            <div className="space-y-3">
              {/* Sleek Back Button to Level 1 */}
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className="group flex w-full items-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-950/40 px-3 py-2 text-xs font-semibold text-indigo-300 transition-all hover:border-indigo-500/50 hover:bg-indigo-600 hover:text-white shadow-sm"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                <span>Back to Categories</span>
              </button>

              {/* Active Category Banner */}
              <div className="flex items-center justify-between rounded-xl bg-slate-900/80 px-3 py-2 border border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                    <selectedCategoryObj.icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-bold text-slate-200">
                    {selectedCategoryObj.label}
                  </span>
                </div>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                  {selectedCategoryObj.items.length}
                </span>
              </div>

              {/* Sub-Options List */}
              <div className="space-y-1 pt-1">
                <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
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
                        "group flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-all",
                        isActive
                          ? "bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-900/40"
                          : "text-slate-300 hover:bg-white/10 hover:text-white",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex items-center gap-2.5">
                          <sub.icon
                            className={cn(
                              "h-4 w-4",
                              isActive ? "text-white" : "text-indigo-400 group-hover:text-white",
                            )}
                          />
                          <span>{sub.label}</span>
                        </div>
                        {isActive ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        ) : null}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ) : (
            /* LEVEL 1: MAIN PRIMARY CATEGORIES MENU */
            <div className="space-y-2.5">
              <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Primary Categories
              </p>
              <div className="space-y-1.5">
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
                            "flex items-center justify-between rounded-xl px-3 py-2.5 text-xs transition-all",
                            isActive
                              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/30 font-semibold"
                              : "text-slate-300 hover:bg-white/10 hover:text-white font-medium",
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
                        "group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-all border",
                        isCategoryActive
                          ? "border-indigo-500/40 bg-indigo-950/80 text-white shadow-sm"
                          : "border-white/5 bg-white/[0.02] text-slate-300 hover:border-white/10 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                            isCategoryActive
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "bg-white/5 text-slate-400 group-hover:bg-indigo-600/30 group-hover:text-indigo-300",
                          )}
                        >
                          <cat.icon className="h-3.5 w-3.5" />
                        </div>
                        <span>{cat.label}</span>
                      </div>

                      <div className="flex items-center gap-1 text-slate-400 group-hover:text-white">
                        {cat.items ? (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                            {cat.items.length}
                          </span>
                        ) : null}
                        <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        {/* Signed In User Footer */}
        <div className="border-t border-white/10 p-3 bg-slate-900/60">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5 ring-1 ring-white/5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 font-bold text-white shadow-sm">
              {(user?.name || user?.email || "A").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white" title={user?.name || user?.email}>
                {user?.name || user?.email}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                  {isAdmin ? (isCohost ? "Co-Host" : "Admin") : "Student"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
