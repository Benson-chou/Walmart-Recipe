"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";

type SiteHeaderProps = {
  username?: string | null;
  loggedIn?: boolean;
};

export function SiteHeader({ username, loggedIn }: SiteHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  async function handleLogout() {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/home");
    router.refresh();
  }

  return (
    <header className="site-header">
      <Link href="/home" className="brand">
        Loblaws Recipe
      </Link>
      <nav className="nav-links">
        {loggedIn ? (
          <>
            <Link href="/profile" className={pathname === "/profile" ? "active" : undefined}>
              {username || "Profile"}
            </Link>
            <button type="button" className="link-button" onClick={handleLogout}>
              Log out
            </button>
          </>
        ) : (
          <>
            {!isAuthPage && (
              <Link href="/home" className={pathname === "/home" ? "active" : undefined}>
                Guest
              </Link>
            )}
            <Link href="/login" className={pathname === "/login" ? "active" : undefined}>
              Login
            </Link>
            <Link href="/signup" className={pathname === "/signup" ? "active" : undefined}>
              Sign up
            </Link>
          </>
        )}
        <a
          href="https://github.com/Benson-chou/loblawRecipe"
          target="_blank"
          rel="noreferrer"
          className="github-link"
          aria-label="GitHub repository"
        >
          GitHub
        </a>
      </nav>
    </header>
  );
}
