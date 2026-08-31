import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

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
    const preferred_location =
      typeof body.preferred_location === "string"
        ? body.preferred_location.toLowerCase().replace(/\s+/g, "")
        : undefined;
    const allergies =
      typeof body.allergies === "string" ? body.allergies : undefined;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

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

    return NextResponse.json({ profile: data });
  } catch {
    return NextResponse.json({ message: "Server Error" }, { status: 500 });
  }
}
