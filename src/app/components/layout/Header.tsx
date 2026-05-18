import React, { useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useLocation, useNavigate } from "react-router";
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { LogOut, User, Bell, Menu } from 'lucide-react';

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const pageTitle = useMemo(() => {
    const p = location.pathname;
    if (p.startsWith("/admin/tests")) return "Test Management";
    if (p.startsWith("/admin/batches")) return "Batch Management";
    if (p.startsWith("/admin/students")) return "Students";
    if (p.startsWith("/admin/media")) return "Media Manager";
    if (p === "/admin") return "Dashboard";
    if (p.startsWith("/student/media")) return "Media Library";
    if (p.startsWith("/student/tests")) return "Test Schedule";
    if (p === "/student") return "Dashboard";
    return "Dashboard";
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {/* Mobile Menu Button */}
        <Button 
          variant="ghost" 
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="w-5 h-5" />
        </Button>

        <div className="flex flex-col min-w-0">
          <div className="text-sm text-slate-500 hidden sm:block">
            {user?.role === "admin" ? "Admin Panel" : "Student Panel"}
          </div>
          <div className="text-lg md:text-xl font-semibold text-slate-900 truncate">
            {pageTitle}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 md:gap-3 h-auto py-2">
              <Avatar className="w-8 h-8 md:w-9 md:h-9 bg-indigo-600">
                {user?.photoURL ? (
                  <AvatarImage src={user.photoURL} alt="" className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-indigo-600 text-white">
                  {user ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="text-left hidden md:block">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-slate-500">
                  {user?.role === "admin" ? "Administrator" : "Student"}
                </p>
                {user?.role === "student" && user?.studentId ? (
                  <p className="text-xs text-slate-500">ID: {user.studentId}</p>
                ) : null}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="w-4 h-4 mr-2" />
              Profile Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}