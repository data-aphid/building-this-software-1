import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserCog, Info } from "lucide-react";

export default function Team() {
  const { data: members, isLoading } = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
      if (!ids.length) return [];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      return ids.map((id) => ({
        id,
        name: profiles?.find((p) => p.id === id)?.full_name || "Unnamed",
        roles: (roles ?? []).filter((r) => r.user_id === id).map((r) => r.role),
      }));
    },
  });

  return (
    <div>
      <PageHeader
        title="Team"
        description="People with access to this workspace and their roles."
      />

      <Card className="border-primary/20 bg-primary-soft/40 mb-6">
        <CardContent className="p-4 flex gap-3">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold mb-1">Inviting teammates</p>
            <p className="text-muted-foreground">
              Email invitations are coming in v2. For now, ask your manager / caretaker / accountant to sign up at the login page —
              then assign their role here once they appear in the list.
            </p>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !members?.length ? (
        <Card className="border-dashed border-2 bg-gradient-clay/40">
          <CardContent className="p-10 text-center">
            <UserCog className="h-10 w-10 text-primary mx-auto mb-3" />
            <h3 className="font-display text-xl">No team members yet</h3>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <Card key={m.id} className="border-border/60 shadow-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-secondary-soft text-secondary flex items-center justify-center font-semibold">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{m.name}</p>
                  <div className="flex gap-1 flex-wrap mt-1">
                    {m.roles.map((r) => (
                      <Badge key={r} variant="secondary" className="capitalize">{r}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
