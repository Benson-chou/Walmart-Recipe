import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { cleanZipCode, isValidUsZip } from "@/lib/location";
import { createClient } from "@/lib/supabase/server";
import { refreshUserEmbedding } from "@/lib/user-vector";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ message: "Supabase is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, preferred_location, allergies")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    return NextResponse.json({ message: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ message: "Supabase is not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let preferred_location: string | undefined;
    if (typeof body.preferred_location === "string") {
      const cleaned = cleanZipCode(body.preferred_location);
      if (!isValidUsZip(cleaned)) {
        return NextResponse.json(
          { message: "Enter a valid US ZIP code (e.g. 90210)." },
          { status: 400 }
        );
      }
      preferred_location = cleaned;
    }
    const allergies =
      typeof body.allergies === "string" ? body.allergies : undefined;

    const { data, error } = await supabase
      .from("profiles")
      .update({
        ...(preferred_location ? { preferred_location } : {}),
        ...(allergies !== undefined ? { allergies } : {}),
      })
      .eq("id", user.id)
      .select("id, username, preferred_location, allergies")
      .single();

    if (error) {
      return NextResponse.json({ message: "Failed to update profile" }, { status: 500 });
    }

    try {
      await refreshUserEmbedding(user.id);
    } catch (err) {
      console.error("refreshUserEmbedding failed:", err);
    }

    return NextResponse.json({ profile: data });
  } catch {
    return NextResponse.json({ message: "Server Error" }, { status: 500 });
  }
}
