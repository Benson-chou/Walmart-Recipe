import { NextResponse } from "next/server";
import { getLocalFlyerItems } from "@/lib/flyer";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("items")
      .select("id, item_name, price, image, sale_story")
      .order("item_name");

    if (!error && data && data.length > 0) {
      return NextResponse.json({
        items: data.map((row) => ({
          id: row.id,
          item_name: row.item_name,
          price: Number(row.price),
          image: row.image,
          sale_story: row.sale_story,
        })),
      });
    }
  }

  return NextResponse.json({ items: getLocalFlyerItems() });
}
