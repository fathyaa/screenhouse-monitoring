import { Menu } from "lucide-react";
import Sidebar from "../layouts/Sidebar";
import { useSidebarOpen } from "../hooks/useSidebarOpen";

export default function AdminPageShell({ title, subtitle, children }) {
  const { isOpen: sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebarOpen();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  return (
    <div className="app-shell fixed inset-0 flex bg-bl-surface overflow-hidden text-left">
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} role={user?.role} user={user} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 text-left">
        <header className="app-topbar h-14 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition shrink-0"
              aria-label="Toggle sidebar"
            >
              <Menu size={20} className="icon-muted" />
            </button>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-800 truncate">{title}</div>
              {subtitle && <div className="text-xs text-gray-600 truncate">{subtitle}</div>}
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}
