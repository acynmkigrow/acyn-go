import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in · ACYN-Go" },
      { name: "description", content: "Sign in or create an ACYN-Go account to open the web console." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/console" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/console" },
        });
        if (error) throw error;
        toast.success("Check your email to confirm, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.invalidate();
        navigate({ to: "/console" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
      <div className="w-full max-w-md rounded-md border border-border bg-card p-5 sm:p-6">
        <h1 className="mb-2 font-display text-3xl font-semibold text-foreground">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Pair the web console to your locally-running acyn-go agent."
            : "You'll get instant access to the console and audit log."}
        </p>
        <form onSubmit={submit} className="space-y-4">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="Password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary text-primary-foreground py-3 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
        <div className="mt-8 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← Back to home</Link>
        </div>
      </div>
    </div>
  );
}
