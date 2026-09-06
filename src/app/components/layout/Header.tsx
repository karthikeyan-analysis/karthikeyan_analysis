import React, { useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useLocation, useNavigate } from "react-router";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { LogOut, Menu, ChevronDown } from "lucide-react";
import { useStudentPhoto } from "../../features/students/useStudentPhoto";

interface HeaderProps {
  onMenuClick?: () => void;
}

function resolvePageTitle(pathname: string, isCohost?: boolean): { panel: string; title: string } {
  if (pathname.startsWith("/admin")) {
    const panel = isCohost ? "Co-Host" : "Admin";
    if (pathname.startsWith("/admin/live-classes")) return { panel, title: "Live Classes" };
    if (pathname.startsWith("/admin/live-tests")) return { panel, title: isCohost ? "Live Test Monitor" : "Live Test Engine" };
    if (pathname.startsWith("/admin/co-hosts")) return { panel, title: "Co-Host Management" };
    if (pathname.startsWith("/admin/tests/live-monitor")) return { panel, title: "Live Monitor" };
    if (pathname.startsWith("/admin/tests/analytics")) return { panel, title: "Test Analytics" };
    if (pathname.startsWith("/admin/tests/attendance")) return { panel, title: "Test Attendance" };
    if (pathname.startsWith("/admin/reports/student-tests")) return { panel, title: "Student Test Reports" };
    if (pathname.startsWith("/admin/tests")) return { panel, title: "Test Management" };
    if (pathname.startsWith("/admin/batches")) return { panel, title: "Batch Management" };
    if (pathname.startsWith("/admin/students")) return { panel, title: "Students" };
    if (pathname.startsWith("/admin/enrollments")) return { panel, title: "Enrollments" };
    if (pathname.startsWith("/admin/media")) return { panel, title: "Media Manager" };
    if (pathname.startsWith("/admin/public-registrations")) return { panel, title: "Public Registrations" };
    if (pathname.startsWith("/admin/portal-settings")) return { panel, title: "Portal Settings" };
    if (pathname === "/admin") return { panel, title: "Dashboard" };
    return { panel, title: isCohost ? "Co-Host" : "Admin" };
  }

  const panel = "Student";
  if (pathname.startsWith("/student/live-classes")) return { panel, title: "Live Classes" };
  if (pathname.startsWith("/student/media")) return { panel, title: "Media Library" };
  if (pathname.startsWith("/student/tests")) return { panel, title: "Tests" };
  if (pathname === "/student") return { panel, title: "Dashboard" };
  return { panel, title: "Student" };
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { displaySrc: avatarSrc } = useStudentPhoto();

  const isCohost = user?.adminKind === "cohost";
  const { panel, title } = useMemo(
    () => resolvePageTitle(location.pathname, isCohost),
    [location.pathname, isCohost],
  );

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const roleLabel =
    user?.role === "admin"
      ? user?.adminKind === "cohost"
        ? "Co-Host"
        : "Administrator"
      : "Student";

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>

        <div className="min-w-0">
          <p className="hidden text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:block">
            {panel}
          </p>
          <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 md:text-xl">
            {title}
          </h1>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-auto gap-2 rounded-xl border border-transparent px-2 py-1.5 hover:border-slate-200 hover:bg-slate-50"
          >
            <Avatar className="h-8 w-8 bg-indigo-600 md:h-9 md:w-9">
              {avatarSrc ? (
                <AvatarImage
                  src={avatarSrc}
                  alt=""
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : null}
              <AvatarFallback className="bg-indigo-600 text-xs text-white">
                {user ? getInitials(user.name) : "U"}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-left md:block">
              <p className="max-w-[140px] truncate text-sm font-medium text-slate-900">
                {user?.name}
              </p>
              <p className="text-xs text-slate-500">{roleLabel}</p>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium text-slate-900">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
            {user?.role === "student" && user?.studentId ? (
              <p className="mt-1 text-xs text-slate-400">ID: {user.studentId}</p>
            ) : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-red-600 focus:text-red-600"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
