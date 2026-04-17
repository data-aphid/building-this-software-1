import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, MapPin, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1, "Name required").max(100),
  address: z.string().trim().max(255).optional(),
  description: z.string().trim().max(500).optional(),
});

export default function Properties() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: properties, isLoading } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, address, description, image_url, units(id, status)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMut = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("properties").insert({
        name: values.name,
        address: values.address,
        description: values.description,
        created_by: u.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Property added");
      qc.invalidateQueries({ queryKey: ["properties"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    createMut.mutate(parsed.data);
  };

  return (
    <div>
      <PageHeader
        title="Properties"
        description="All the buildings and compounds you manage."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="h-4 w-4 mr-2" /> Add property
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">New property</DialogTitle>
              </DialogHeader>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" placeholder="e.g. Greenview Apartments" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" name="address" placeholder="e.g. Kileleshwa, Nairobi" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" rows={3} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMut.isPending}>
                    {createMut.isPending ? "Saving…" : "Save property"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !properties?.length ? (
        <Card className="border-dashed border-2 border-border bg-gradient-clay/40">
          <CardContent className="p-12 text-center">
            <div className="h-14 w-14 rounded-2xl bg-primary-soft text-primary mx-auto flex items-center justify-center mb-4">
              <Building2 className="h-7 w-7" />
            </div>
            <h3 className="font-display text-xl font-semibold">No properties yet</h3>
            <p className="text-muted-foreground mt-1 mb-6">Add your first property to start tracking units and tenants.</p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add property
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((p) => {
            const total = p.units?.length ?? 0;
            const occ = p.units?.filter((u) => u.status === "occupied").length ?? 0;
            return (
              <Link key={p.id} to={`/properties/${p.id}`}>
                <Card className="border-border/60 shadow-card hover:shadow-warm hover:border-primary/30 transition-all group h-full">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="h-11 w-11 rounded-lg bg-gradient-warm flex items-center justify-center shrink-0 shadow-warm">
                        <Building2 className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-lg font-semibold truncate group-hover:text-primary transition-colors">
                          {p.name}
                        </h3>
                        {p.address && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{p.address}</span>
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{total} {total === 1 ? "unit" : "units"}</Badge>
                      {total > 0 && (
                        <Badge className="bg-success/15 text-success hover:bg-success/15">
                          {occ}/{total} occupied
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
