import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Building2, Home, Wallet, AlertCircle, TrendingUp, Users, FileText, UserCog, Settings, LayoutDashboard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KES, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

const quickLinks = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Properties", url: "/properties", icon: Building2 },
  { title: "Tenants", url: "/tenants", icon: Users },
  { title: "Leases", url: "/leases", icon: FileText },
  { title: "Payments", url: "/payments", icon: Wallet },
  { title: "Team", url: "/team", icon: UserCog },
  { title: "Settings", url: "/settings", icon: Settings },
];

export default function Dashboard() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [props, units, leases, payments] = await Promise.all([
        supabase.from("properties").select("id", { count: "exact", head: true }),
        supabase.from("units").select("id, status, rent_amount"),
        supabase.from("leases").select("id, rent_amount, status, tenant_id, tenants(full_name)").eq("status", "active"),
        supabase.from("payments").select("amount, paid_on, lease_id, leases(tenant_id, tenants(full_name))").order("paid_on", { ascending: false }),
      ]);

      const totalUnits = units.data?.length ?? 0;
      const occupied = units.data?.filter((u) => u.status === "occupied").length ?? 0;
      const vacant = units.data?.filter((u) => u.status === "vacant").length ?? 0;
      const expectedMonthly = leases.data?.reduce((s, l) => s + Number(l.rent_amount), 0) ?? 0;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const collectedThisMonth = payments.data
        ?.filter((p) => new Date(p.paid_on) >= monthStart)
        .reduce((s, p) => s + Number(p.amount), 0) ?? 0;

      // arrears: per active lease, sum payments since lease start vs months elapsed * rent
      const arrears: { name: string; balance: number }[] = [];
      for (const lease of leases.data ?? []) {
        const paid = payments.data
          ?.filter((p) => p.lease_id === lease.id)
          .reduce((s, p) => s + Number(p.amount), 0) ?? 0;
        const expected = Number(lease.rent_amount); // simple v1: 1 month expected
        const balance = expected - paid;
        if (balance > 0) {
          arrears.push({
            name: (lease.tenants as { full_name?: string } | null)?.full_name ?? "Unknown",
            balance,
          });
        }
      }

      return {
        propertyCount: props.count ?? 0,
        totalUnits,
        occupied,
        vacant,
        occupancyPct: totalUnits ? Math.round((occupied / totalUnits) * 100) : 0,
        expectedMonthly,
        collectedThisMonth,
        recentPayments: (payments.data ?? []).slice(0, 5),
        arrears: arrears.slice(0, 5),
      };
    },
  });

  return (
    <div>
      <PageHeader
        title="Karibu 👋"
        description={`Here's what's happening across your properties${user?.email ? "" : ""}.`}
      />

      {/* Quick links to all sections */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3 mb-6">
        {quickLinks.map((l) => (
          <Link
            key={l.title}
            to={l.url}
            className="group flex flex-col items-center justify-center gap-2 rounded-lg border border-black/10 bg-white text-black px-3 py-4 font-semibold shadow-card hover:bg-black hover:text-white transition-colors"
          >
            <l.icon className="h-5 w-5" />
            <span className="text-sm">{l.title}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <Link to="/properties" className="block focus:outline-none focus:ring-2 focus:ring-ring rounded-xl">
          <StatCard label="Properties" value={isLoading ? "—" : data?.propertyCount ?? 0} icon={Building2} tone="primary" />
        </Link>
        <Link to="/properties" className="block focus:outline-none focus:ring-2 focus:ring-ring rounded-xl">
          <StatCard
            label="Occupancy"
            value={isLoading ? "—" : `${data?.occupancyPct ?? 0}%`}
            hint={isLoading ? undefined : `${data?.occupied}/${data?.totalUnits} units`}
            icon={Home}
            tone="secondary"
          />
        </Link>
        <Link to="/leases" className="block focus:outline-none focus:ring-2 focus:ring-ring rounded-xl">
          <StatCard
            label="Expected (mo)"
            value={isLoading ? "—" : KES(data?.expectedMonthly ?? 0)}
            icon={TrendingUp}
            tone="success"
          />
        </Link>
        <Link to="/payments" className="block focus:outline-none focus:ring-2 focus:ring-ring rounded-xl">
          <StatCard
            label="Collected (mo)"
            value={isLoading ? "—" : KES(data?.collectedThisMonth ?? 0)}
            icon={Wallet}
            tone="primary"
          />
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="border-border/60 shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-xl flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Tenants in arrears
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : data?.arrears.length ? (
              <ul className="divide-y divide-border">
                {data.arrears.map((a, i) => (
                  <li key={i} className="py-3 flex items-center justify-between">
                    <span className="font-medium">{a.name}</span>
                    <Badge variant="destructive">{KES(a.balance)}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">All tenants are up to date 🎉</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-xl">Recent payments</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : data?.recentPayments.length ? (
              <ul className="divide-y divide-border">
                {data.recentPayments.map((p, i) => {
                  const tenantName = (p.leases as { tenants?: { full_name?: string } } | null)?.tenants?.full_name ?? "Unknown";
                  return (
                    <li key={i} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{tenantName}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(p.paid_on)}</p>
                      </div>
                      <span className="font-semibold text-success shrink-0">{KES(p.amount)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
