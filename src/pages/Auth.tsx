import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import heroImg from "@/assets/hero-courtyard.jpg";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Min 6 characters").max(100),
});

const signupSchema = loginSchema.extend({
  full_name: z.string().trim().min(2, "Enter your name").max(100),
  business_name: z.string().trim().max(100).optional(),
});

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else toast.success("Welcome back");
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: parsed.data.full_name,
          business_name: parsed.data.business_name,
        },
      },
    });
    setSubmitting(false);
    if (error) {
      if (error.message.includes("already")) toast.error("Account exists. Please log in.");
      else toast.error(error.message);
    } else {
      toast.success("Account created. You can sign in now.");
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Hero */}
      <div className="hidden lg:block relative overflow-hidden">
        <img
          src={heroImg}
          alt="Warm sunlit Kenyan courtyard"
          className="absolute inset-0 w-full h-full object-cover"
          width={1600}
          height={1024}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-secondary/70 via-secondary/40 to-primary/40" />
        <div className="relative h-full flex flex-col justify-between p-10 text-primary-foreground">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary-foreground/15 backdrop-blur flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-semibold">NyumbaFlow</span>
          </div>
          <div>
            <h1 className="font-display text-4xl xl:text-5xl font-semibold leading-tight text-balance">
              Run your properties with calm and clarity.
            </h1>
            <p className="mt-4 text-primary-foreground/80 max-w-md">
              Track tenants, leases and rent across all your buildings — built for Kenyan landlords who want their evenings back.
            </p>
          </div>
          <div className="text-xs text-primary-foreground/60">
            © {new Date().getFullYear()} NyumbaFlow
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-border/60 shadow-card">
          <CardContent className="p-6 sm:p-8">
            <div className="lg:hidden flex items-center gap-2 mb-6">
              <div className="h-9 w-9 rounded-lg bg-gradient-warm flex items-center justify-center shadow-warm">
                <Building2 className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display text-xl font-semibold">NyumbaFlow</span>
            </div>

            <h2 className="font-display text-2xl font-semibold mb-1">Welcome</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Sign in or create your landlord account to get started.
            </p>

            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Log in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" name="email" type="email" autoComplete="email" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password">Password</Label>
                    <Input id="login-password" name="password" type="password" autoComplete="current-password" required />
                  </div>
                  <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Sign in
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="su-name">Full name</Label>
                    <Input id="su-name" name="full_name" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-business">Business name <span className="text-muted-foreground">(optional)</span></Label>
                    <Input id="su-business" name="business_name" placeholder="e.g. Karibu Properties" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-email">Email</Label>
                    <Input id="su-email" name="email" type="email" autoComplete="email" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-password">Password</Label>
                    <Input id="su-password" name="password" type="password" autoComplete="new-password" required minLength={6} />
                  </div>
                  <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create account
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    The first account becomes the workspace admin.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
