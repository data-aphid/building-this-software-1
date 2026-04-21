import { Building2, Home, Users, FileText, Wallet, UserCog, Settings, LogOut, Menu } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", url: "/", icon: Home, roles: ["admin", "manager", "caretaker", "accountant"] as const },
  { title: "Properties", url: "/properties", icon: Building2, roles: ["admin", "manager", "caretaker"] as const },
  { title: "Tenants", url: "/tenants", icon: Users, roles: ["admin", "manager", "caretaker"] as const },
  { title: "Leases", url: "/leases", icon: FileText, roles: ["admin", "manager"] as const },
  { title: "Payments", url: "/payments", icon: Wallet, roles: ["admin", "manager", "accountant"] as const },
  { title: "Team", url: "/team", icon: UserCog, roles: ["admin"] as const },
  { title: "Settings", url: "/settings", icon: Settings, roles: ["admin", "manager", "caretaker", "accountant", "tenant"] as const },
];

export function TopNav() {
  const { roles, signOut, user } = useAuth();
  const visible = navItems.filter((item) => item.roles.some((r) => roles.includes(r as never)));

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
      isActive
        ? "bg-primary text-primary-foreground shadow-soft"
        : "text-foreground/80 hover:bg-muted hover:text-foreground"
    );

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/70">
      <div className="max-w-7xl mx-auto flex h-14 items-center gap-3 px-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-9 w-9 rounded-lg bg-gradient-warm flex items-center justify-center shadow-warm">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="font-display text-base font-semibold text-foreground">NyumbaFlow</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Property Management</span>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1 overflow-x-auto">
          {visible.map((item) => (
            <NavLink key={item.title} to={item.url} end className={linkClass}>
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </NavLink>
          ))}
        </nav>

        <div className="flex-1 md:flex-none" />

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          {/* Mobile menu */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {visible.map((item) => (
                  <DropdownMenuItem key={item.title} asChild>
                    <NavLink to={item.url} end className="flex items-center gap-2 w-full">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Desktop user menu */}
          <div className="hidden md:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="max-w-[160px]">
                  <span className="truncate">{user?.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="truncate max-w-[220px]">{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
