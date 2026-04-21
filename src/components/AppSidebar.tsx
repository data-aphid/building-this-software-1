import { Building2, Home, Users, FileText, Wallet, UserCog, Settings, LogOut } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Dashboard", url: "/", icon: Home, roles: ["admin", "manager", "caretaker", "accountant"] as const },
  { title: "Properties", url: "/properties", icon: Building2, roles: ["admin", "manager", "caretaker"] as const },
  { title: "Tenants", url: "/tenants", icon: Users, roles: ["admin", "manager", "caretaker"] as const },
  { title: "Leases", url: "/leases", icon: FileText, roles: ["admin", "manager"] as const },
  { title: "Payments", url: "/payments", icon: Wallet, roles: ["admin", "manager", "accountant"] as const },
  { title: "Team", url: "/team", icon: UserCog, roles: ["admin"] as const },
  { title: "Settings", url: "/settings", icon: Settings, roles: ["admin", "manager", "caretaker", "accountant", "tenant"] as const },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { roles, signOut, user } = useAuth();

  const visible = navItems.filter((item) => item.roles.some((r) => roles.includes(r as never)));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-warm flex items-center justify-center shrink-0 shadow-warm">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-display text-lg font-semibold text-sidebar-foreground">NyumbaFlow</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/75">Property Management</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Workspace</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <NavLink to={item.url} end>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && (
          <div className="px-2 py-2 text-xs font-medium text-sidebar-foreground/85 truncate">
            {user?.email}
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut()}
          className="justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sign out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
