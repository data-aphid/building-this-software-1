import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Users, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  full_name: z.string().trim().min(2, "Name required").max(100),
  national_id: z.string().trim().max(30).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  next_of_kin_name: z.string().trim().max(100).optional(),
  next_of_kin_phone: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(500).optional(),
});

export default function Tenants() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*, leases(id, status, units(name, properties(name)))")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const createMut = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      const payload = { ...values, email: values.email || null };
      const { error } = await supabase.from("tenants").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tenant added");
      qc.invalidateQueries({ queryKey: ["tenants"] });
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
        title="Tenants"
        description="Everyone renting from you, in one place."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg"><Plus className="h-4 w-4 mr-2" /> Add tenant</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">New tenant</DialogTitle>
              </DialogHeader>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="full_name">Full name</Label>
                    <Input id="full_name" name="full_name" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="national_id">National ID</Label>
                    <Input id="national_id" name="national_id" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" name="phone" placeholder="+254…" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="next_of_kin_name">Next of kin</Label>
                    <Input id="next_of_kin_name" name="next_of_kin_name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="next_of_kin_phone">NOK phone</Label>
                    <Input id="next_of_kin_phone" name="next_of_kin_phone" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" rows={2} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMut.isPending}>
                    {createMut.isPending ? "Saving…" : "Save tenant"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !tenants?.length ? (
        <Card className="border-dashed border-2 bg-gradient-clay/40">
          <CardContent className="p-12 text-center">
            <div className="h-14 w-14 rounded-2xl bg-primary-soft text-primary mx-auto flex items-center justify-center mb-4">
              <Users className="h-7 w-7" />
            </div>
            <h3 className="font-display text-xl font-semibold">No tenants yet</h3>
            <p className="text-muted-foreground mt-1">Add a tenant and assign them to a unit via Leases.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tenants.map((t) => {
            const active = t.leases?.find((l) => l.status === "active");
            const unit = active?.units as { name?: string; properties?: { name?: string } } | undefined;
            return (
              <Card key={t.id} className="border-border/60 shadow-card hover:shadow-soft transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-secondary-soft text-secondary flex items-center justify-center font-semibold shrink-0">
                      {t.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{t.full_name}</p>
                      {unit ? (
                        <p className="text-xs text-muted-foreground truncate">
                          {unit.properties?.name} · Unit {unit.name}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">No active lease</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    {t.phone && (
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" /> {t.phone}
                      </p>
                    )}
                    {t.email && (
                      <p className="flex items-center gap-2 text-muted-foreground truncate">
                        <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{t.email}</span>
                      </p>
                    )}
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
