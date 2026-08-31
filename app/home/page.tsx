import { HomeClient } from "@/components/HomeClient";
import { getLocalFlyerItems } from "@/lib/flyer";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let items = getLocalFlyerItems();
  let loggedIn = false;
  let username: string | null = null;
  let location = "m5b1r7";
  let allergies = "None";

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: dbItems } = await supabase
      .from("items")
      .select("id, item_name, price, image, sale_story")
      .order("item_name");

    if (dbItems && dbItems.length > 0) {
      items = dbItems.map((row) => ({
        id: row.id,
        item_name: row.item_name,
        price: Number(row.price),
        image: row.image,
        sale_story: row.sale_story,
      }));
    }

    if (user) {
      loggedIn = true;
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, preferred_location, allergies")
        .eq("id", user.id)
        .maybeSingle();

      username = profile?.username ?? user.email ?? "User";
      location = profile?.preferred_location ?? "m5b1r7";
      allergies = profile?.allergies ?? "None";
    }
  }

  return (
    <HomeClient
      items={items}
      loggedIn={loggedIn}
      username={username}
      location={location}
      allergies={allergies}
    />
  );
}
