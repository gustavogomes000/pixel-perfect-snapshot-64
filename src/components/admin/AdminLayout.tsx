import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Image, FileText, Settings, LogOut, Menu, X, Video } from "lucide-react";
import { useAdmin, painelLogout } from "@/hooks/useAdmin";

const navItems = [
  { to: "/admin/galeria", icon: Image, label: "Galeria" },
  { to: "/admin/hero-video", icon: Video, label: "Hero" },
  { to: "/admin/formularios", icon: FileText, label: "Formulários" },
  { to: "/admin/configuracoes", icon: Settings, label: "Config" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAdmin();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    painelLogout();
    navigate("/admin/login");
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-secondary">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-secondary">
      {/* Top header - always visible */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-card px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl hover:bg-accent transition-colors"
            aria-label="Menu"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <h1 className="text-sm font-bold text-primary">Painel Admin</h1>
        </div>
        <span className="text-xs text-muted-foreground">{user?.nome}</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar desktop */}
        <aside className="hidden lg:flex lg:w-56 flex-col border-r bg-card shrink-0">
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-3 border-t">
            <button onClick={handleLogout} className="flex items-center gap-2 w-full rounded-xl px-4 py-3 text-sm text-muted-foreground hover:bg-accent transition-colors">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-foreground/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}>
            <div
              className="w-72 h-full bg-card border-r flex flex-col animate-in slide-in-from-left-full duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-primary">Painel Admin</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{user?.nome}</p>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-accent">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 p-3 space-y-1">
                {navItems.map((item) => {
                  const active = location.pathname === item.to;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-colors ${
                        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="p-3 border-t">
                <button onClick={handleLogout} className="flex items-center gap-2 w-full rounded-xl px-4 py-3 text-sm text-muted-foreground hover:bg-accent">
                  <LogOut className="h-4 w-4" /> Sair
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden sticky bottom-0 z-30 flex border-t bg-card shrink-0 safe-area-bottom">
        {navItems.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className={`h-5 w-5 ${active ? "text-primary" : ""}`} />
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-muted-foreground"
        >
          <LogOut className="h-5 w-5" />
          Sair
        </button>
      </nav>
    </div>
  );
}
