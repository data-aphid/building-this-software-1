import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Building2, Home, Wallet, AlertCircle, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KES, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <StatCard label="Properties" value={isLoading ? "—" : data?.propertyCount ?? 0} icon={Building2} tone="primary" />
        <StatCard
          label="Occupancy"
          value={isLoading ? "—" : `${data?.occupancyPct ?? 0}%`}
          hint={isLoading ? undefined : `${data?.occupied}/${data?.totalUnits} units`}
          icon={Home}
          tone="secondary"
        />
        <StatCard
          label="Expected (mo)"
          value={isLoading ? "—" : KES(data?.expectedMonthly ?? 0)}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label="Collected (mo)"
          value={isLoading ? "—" : KES(data?.collectedThisMonth ?? 0)}
          icon={Wallet}
          tone="primary"
        />
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
