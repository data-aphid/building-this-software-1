import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { KES, formatDate } from "@/lib/format";
import { z } from "zod";

const schema = z.object({
  lease_id: z.string().uuid("Select a lease"),
  amount: z.coerce.number().positive("Amount must be > 0"),
  paid_on: z.string().min(1, "Date required"),
  method: z.enum(["cash", "mpesa", "bank_transfer", "cheque", "other"]),
  reference: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional(),
});

const methodLabels: Record<string, string> = {
  cash: "Cash",
  mpesa: "M-Pesa",
  bank_transfer: "Bank",
  cheque: "Cheque",
  other: "Other",
};

export default function Payments() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, leases(rent_amount, tenants(full_name), units(name, properties(name)))")
        .order("paid_on", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: activeLeases } = useQuery({
    queryKey: ["active-leases"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leases")
        .select("id, rent_amount, tenants(full_name), units(name)")
        .eq("status", "active");
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("payments").insert({
        ...values,
        recorded_by: u.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    createMut.mutate(parsed.data);
  };

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Record and review every payment received."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg"><Plus className="h-4 w-4 mr-2" /> Record payment</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">New payment</DialogTitle>
              </DialogHeader>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="lease_id">Tenant / lease</Label>
                  <Select name="lease_id" required>
                    <SelectTrigger><SelectValue placeholder="Choose lease" /></SelectTrigger>
                    <SelectContent>
                      {activeLeases?.map((l) => {
                        const t = (l.tenants as { full_name?: string } | null)?.full_name;
                        const un = (l.units as { name?: string } | null)?.name;
                        return <SelectItem key={l.id} value={l.id}>{t} — Unit {un}</SelectItem>;
                      })}
                      {!activeLeases?.length && <div className="p-2 text-sm text-muted-foreground">No active leases</div>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="amount">Amount (KES)</Label>
                    <Input id="amount" name="amount" type="number" min={1} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="paid_on">Date</Label>
                    <Input id="paid_on" name="paid_on" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="method">Method</Label>
                    <Select name="method" defaultValue="mpesa">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(methodLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reference">Reference</Label>
                    <Input id="reference" name="reference" placeholder="M-Pesa code" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" rows={2} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMut.isPending}>
                    {createMut.isPending ? "Saving…" : "Save payment"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !payments?.length ? (
        <Card className="border-dashed border-2 bg-gradient-clay/40">
          <CardContent className="p-12 text-center">
            <div className="h-14 w-14 rounded-2xl bg-primary-soft text-primary mx-auto flex items-center justify-center mb-4">
              <Wallet className="h-7 w-7" />
            </div>
            <h3 className="font-display text-xl font-semibold">No payments yet</h3>
            <p className="text-muted-foreground mt-1">Record your first rent payment to start tracking.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {payments.map((p) => {
            const lease = p.leases as { tenants?: { full_name?: string }; units?: { name?: string; properties?: { name?: string } } } | null;
            return (
              <Card key={p.id} className="border-border/60 shadow-card">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-success/15 text-success flex items-center justify-center shrink-0">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{lease?.tenants?.full_name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {lease?.units?.properties?.name} · Unit {lease?.units?.name} · {formatDate(p.paid_on)}
                      {p.reference && ` · ${p.reference}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display text-lg font-semibold">{KES(p.amount)}</p>
                    <Badge variant="secondary" className="text-[10px]">{methodLabels[p.method]}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
