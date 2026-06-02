import { useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "../layouts/Sidebar";

export default function AdminPageShell({ title, subtitle, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  return (
    <div className="fixed inset-0 flex bg-slate-100 overflow-hidden text-left">
      <Sidebar isOpen={sidebarOpen} role={user?.role} user={user} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 text-left">
        <header className="h-14 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-5 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            >
              <Menu size={20} className="text-gray-500" />
            </button>
            <div>
              <div className="text-sm font-semibold text-gray-800">{title}</div>
              {subtitle && <div className="text-xs text-gray-400">{subtitle}</div>}
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}
