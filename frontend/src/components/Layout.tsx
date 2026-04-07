import { useAuthStore } from "@/store/auth";
import DemoTour from "@/components/DemoTour";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, TrendingUp, Upload, LogOut, Package, Thermometer, Map } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Overview", tour: "nav-overview" },
  { href: "/inventory", icon: Package, label: "Inventory", tour: "nav-inventory" },
  { href: "/forecast", icon: TrendingUp, label: "Forecasting", tour: "nav-forecast" },
  { href: "/cold-chain", icon: Thermometer, label: "Cold Chain", tour: "nav-cold-chain" },
  { href: "/coverage-map", icon: Map, label: "Coverage Map", tour: "nav-coverage-map" },
  { href: "/ingestion", icon: Upload, label: "Data Ingestion", tour: "nav-ingestion" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { logout, email } = useAuthStore();
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-6 border-b flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white text-sm font-bold">
            V
          </div>
          <div>
            <p className="font-semibold text-sm">VaxAI Vision</p>
            <p className="text-xs text-muted-foreground">Supply Chain Intelligence</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ href, icon: Icon, label, tour }) => {
            const active = location.pathname === href;
            return (
              <Link key={href} to={href} data-tour={tour}>
                <div
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium uppercase">
              {email?.[0] ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{email ?? "User"}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={() => logout()}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
      <DemoTour />
    </div>
  );
}
