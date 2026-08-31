"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isSupabaseConfigured()) {
      setError(
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local."
      );
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push("/home");
      router.refresh();
    } catch {
      setError("Failed to log in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell auth-shell">
      <div className="atmosphere auth-atmosphere" aria-hidden />
      <SiteHeader />
      <main className="auth-main">
        <form className="auth-form" onSubmit={onSubmit}>
          <p className="brand-mark">Loblaws Recipe</p>
          <h1>Welcome back</h1>
          <p className="lede">Sign in to save recipes and sync your preferences.</p>

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Signing in…" : "Log in"}
          </button>

          <p className="auth-switch">
            New here? <Link href="/signup">Create an account</Link>
            {" · "}
            <Link href="/home">Try as guest</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
