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
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, LogOut } from "lucide-react";
import { toast } from "sonner";
import { KES, formatDate } from "@/lib/format";
import { z } from "zod";

const schema = z.object({
  tenant_id: z.string().uuid("Select a tenant"),
  unit_id: z.string().uuid("Select a unit"),
  start_date: z.string().min(1, "Start date required"),
  end_date: z.string().optional(),
  rent_amount: z.coerce.number().min(0),
  deposit_amount: z.coerce.number().min(0),
  deposit_paid: z.coerce.number().min(0),
});

export default function Leases() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: leases, isLoading } = useQuery({
    queryKey: ["leases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leases")
        .select("*, tenants(full_name), units(name, properties(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: tenants } = useQuery({
    queryKey: ["tenants-select"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("id, full_name").order("full_name");
      return data ?? [];
    },
  });

  const { data: vacantUnits } = useQuery({
    queryKey: ["vacant-units"],
    queryFn: async () => {
      const { data } = await supabase
        .from("units")
        .select("id, name, rent_amount, deposit_amount, properties(name)")
        .eq("status", "vacant")
        .order("name");
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      const payload = { ...values, end_date: values.end_date || null };
      const { error } = await supabase.from("leases").insert(payload);
      if (error) throw error;
      // mark unit occupied
      await supabase.from("units").update({ status: "occupied" }).eq("id", values.unit_id);
    },
    onSuccess: () => {
      toast.success("Lease created · tenant moved in");
      qc.invalidateQueries({ queryKey: ["leases"] });
      qc.invalidateQueries({ queryKey: ["vacant-units"] });
      qc.invalidateQueries({ queryKey: ["units"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveOutMut = useMutation({
    mutationFn: async ({ leaseId, unitId }: { leaseId: string; unitId: string }) => {
      const { error } = await supabase
        .from("leases")
        .update({ status: "ended", end_date: new Date().toISOString().split("T")[0] })
        .eq("id", leaseId);
      if (error) throw error;
      await supabase.from("units").update({ status: "vacant" }).eq("id", unitId);
    },
    onSuccess: () => {
      toast.success("Tenant moved out");
      qc.invalidateQueries({ queryKey: ["leases"] });
      qc.invalidateQueries({ queryKey: ["vacant-units"] });
      qc.invalidateQueries({ queryKey: ["units"] });
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

  const [selectedUnit, setSelectedUnit] = useState<string>("");
  const unit = vacantUnits?.find((u) => u.id === selectedUnit);

  return (
    <div>
      <PageHeader
        title="Leases"
        description="Active and past tenancy agreements."
        action={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSelectedUnit(""); }}>
            <DialogTrigger asChild>
              <Button size="lg"><Plus className="h-4 w-4 mr-2" /> New lease</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">Move-in tenant</DialogTitle>
              </DialogHeader>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="tenant_id">Tenant</Label>
                  <Select name="tenant_id" required>
                    <SelectTrigger><SelectValue placeholder="Choose tenant" /></SelectTrigger>
                    <SelectContent>
                      {tenants?.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="unit_id">Vacant unit</Label>
                  <Select name="unit_id" value={selectedUnit} onValueChange={setSelectedUnit} required>
                    <SelectTrigger><SelectValue placeholder="Choose unit" /></SelectTrigger>
                    <SelectContent>
                      {vacantUnits?.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {(u.properties as { name?: string } | null)?.name} · {u.name} · {KES(u.rent_amount)}
                        </SelectItem>
                      ))}
                      {!vacantUnits?.length && <div className="p-2 text-sm text-muted-foreground">No vacant units</div>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="start_date">Start date</Label>
                    <Input id="start_date" name="start_date" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="end_date">End date <span className="text-muted-foreground">(opt)</span></Label>
                    <Input id="end_date" name="end_date" type="date" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="rent_amount">Rent</Label>
                    <Input id="rent_amount" name="rent_amount" type="number" min={0} key={unit?.id ?? "r"} defaultValue={unit?.rent_amount ?? 0} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="deposit_amount">Deposit</Label>
                    <Input id="deposit_amount" name="deposit_amount" type="number" min={0} key={(unit?.id ?? "d") + "d"} defaultValue={unit?.deposit_amount ?? 0} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="deposit_paid">Paid</Label>
                    <Input id="deposit_paid" name="deposit_paid" type="number" min={0} defaultValue={0} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMut.isPending}>
                    {createMut.isPending ? "Saving…" : "Move in"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !leases?.length ? (
        <Card className="border-dashed border-2 bg-gradient-clay/40">
          <CardContent className="p-12 text-center">
            <div className="h-14 w-14 rounded-2xl bg-primary-soft text-primary mx-auto flex items-center justify-center mb-4">
              <FileText className="h-7 w-7" />
            </div>
            <h3 className="font-display text-xl font-semibold">No leases yet</h3>
            <p className="text-muted-foreground mt-1">Create a lease to assign a tenant to a unit.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {leases.map((l) => {
            const u = l.units as { name?: string; properties?: { name?: string } } | null;
            return (
              <Card key={l.id} className="border-border/60 shadow-card">
                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-semibold truncate">{(l.tenants as { full_name?: string } | null)?.full_name}</p>
                      <Badge variant={l.status === "active" ? "default" : "secondary"} className="capitalize">{l.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {u?.properties?.name} · Unit {u?.name} · {KES(l.rent_amount)}/mo
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(l.start_date)} → {l.end_date ? formatDate(l.end_date) : "ongoing"}
                    </p>
                  </div>
                  {l.status === "active" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => moveOutMut.mutate({ leaseId: l.id, unitId: l.unit_id })}
                      disabled={moveOutMut.isPending}
                    >
                      <LogOut className="h-4 w-4 mr-2" /> Move out
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
