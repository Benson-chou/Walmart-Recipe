"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AllergyMultiSelect } from "@/components/AllergyMultiSelect";
import { SiteHeader } from "@/components/SiteHeader";
import { createClient } from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/brand";
import { formatAllergies } from "@/lib/allergies";
import { isSupabaseConfigured } from "@/lib/env";
import { cleanZipCode, DEFAULT_ZIP, isValidUsZip } from "@/lib/location";

export function SignupForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);
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

    const cleanZip = cleanZipCode(zipCode);
    if (zipCode && !isValidUsZip(zipCode)) {
      setError("Enter a valid US ZIP code (e.g. 90210).");
      return;
    }

    const allergiesValue = formatAllergies(allergies);

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            preferred_location: cleanZip,
            allergies: allergiesValue,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          username,
          preferred_location: cleanZip,
          allergies: allergiesValue,
        });
      }

      router.push("/home");
      router.refresh();
    } catch {
      setError("Failed to register. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell auth-shell">
      <div className="atmosphere auth-atmosphere" aria-hidden />
      <SiteHeader />
      <main className="auth-main signup-main">
        <div className="signup-visual" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/groceries.jpg" alt="" />
        </div>
        <form className="auth-form" onSubmit={onSubmit}>
          <p className="brand-mark">{APP_NAME}</p>
          <h1>Join the kitchen</h1>
          <p className="lede">Save recipes and personalize Walmart weekly ad deals to your ZIP code.</p>

          <label className="field">
            <span>Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              maxLength={40}
            />
          </label>

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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>

          <label className="field">
            <span>ZIP code</span>
            <input
              type="text"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              placeholder="90210"
              inputMode="numeric"
            />
          </label>

          <div className="field">
            <span>Allergies</span>
            <AllergyMultiSelect value={allergies} onChange={setAllergies} />
          </div>

          {error ? <p className="form-error">{error}</p> : null}

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Creating account…" : "Sign up"}
          </button>

          <p className="auth-switch">
            Already have an account? <Link href="/login">Log in</Link>
            {" · "}
            <Link href="/home">Guest mode</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
