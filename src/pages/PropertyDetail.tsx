import { useState } from "react";
import { useParams, Link } from "react-router-dom";
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
import { ArrowLeft, Plus, DoorOpen, DoorClosed, Clock } from "lucide-react";
import { toast } from "sonner";
import { KES } from "@/lib/format";
import { z } from "zod";
import { cn } from "@/lib/utils";

const unitTypes = [
  { value: "bedsitter", label: "Bedsitter" },
  { value: "single", label: "Single Room" },
  { value: "one_bedroom", label: "1 Bedroom" },
  { value: "two_bedroom", label: "2 Bedroom" },
  { value: "three_bedroom", label: "3 Bedroom" },
  { value: "shop", label: "Shop" },
  { value: "office", label: "Office" },
  { value: "other", label: "Other" },
];

const schema = z.object({
  name: z.string().trim().min(1, "Unit label required").max(50),
  unit_type: z.enum(["bedsitter", "single", "one_bedroom", "two_bedroom", "three_bedroom", "shop", "office", "other"]),
  rent_amount: z.coerce.number().min(0).max(10_000_000),
  deposit_amount: z.coerce.number().min(0).max(10_000_000),
});

const statusStyles = {
  vacant: { icon: DoorOpen, cls: "bg-muted text-muted-foreground" },
  occupied: { icon: DoorClosed, cls: "bg-success/15 text-success" },
  reserved: { icon: Clock, cls: "bg-warning/15 text-warning" },
};

export default function PropertyDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: property } = useQuery({
    queryKey: ["property", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: units, isLoading } = useQuery({
    queryKey: ["units", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units")
        .select("*")
        .eq("property_id", id!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const createMut = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      const { error } = await supabase.from("units").insert({ ...values, property_id: id! });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Unit added");
      qc.invalidateQueries({ queryKey: ["units", id] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      name: fd.get("name"),
      unit_type: fd.get("unit_type"),
      rent_amount: fd.get("rent_amount"),
      deposit_amount: fd.get("deposit_amount"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    createMut.mutate(parsed.data);
  };

  return (
    <div>
      <Link to="/properties" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> All properties
      </Link>

      <PageHeader
        title={property?.name ?? "Property"}
        description={property?.address ?? undefined}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg"><Plus className="h-4 w-4 mr-2" /> Add unit</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">New unit</DialogTitle>
              </DialogHeader>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Label</Label>
                    <Input id="name" name="name" placeholder="e.g. A1" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="unit_type">Type</Label>
                    <Select name="unit_type" defaultValue="bedsitter">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {unitTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="rent_amount">Rent (KES)</Label>
                    <Input id="rent_amount" name="rent_amount" type="number" min={0} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="deposit_amount">Deposit (KES)</Label>
                    <Input id="deposit_amount" name="deposit_amount" type="number" min={0} defaultValue={0} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMut.isPending}>
                    {createMut.isPending ? "Saving…" : "Save unit"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !units?.length ? (
        <Card className="border-dashed border-2 bg-gradient-clay/40">
          <CardContent className="p-10 text-center">
            <h3 className="font-display text-xl">No units yet</h3>
            <p className="text-muted-foreground mt-1">Add the first unit to this property.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {units.map((u) => {
            const s = statusStyles[u.status];
            const Icon = s.icon;
            return (
              <Card key={u.id} className="border-border/60 shadow-card hover:shadow-soft transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-display text-xl font-semibold leading-none">{u.name}</p>
                      <p className="text-xs text-muted-foreground capitalize mt-1">
                        {u.unit_type.replace(/_/g, " ")}
                      </p>
                    </div>
                    <Badge className={cn("gap-1", s.cls)} variant="secondary">
                      <Icon className="h-3 w-3" />
                      {u.status}
                    </Badge>
                  </div>
                  <p className="font-semibold text-sm">{KES(u.rent_amount)}<span className="text-xs text-muted-foreground font-normal">/mo</span></p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
