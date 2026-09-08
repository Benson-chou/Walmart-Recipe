import { HomeClient } from "@/components/HomeClient";
import { getLocalFlyerItems } from "@/lib/flyer";
import { getCachedOrFreshItems } from "@/lib/flyer-scrape";
import { isGroceryName } from "@/lib/grocery-categories";
import { isSupabaseConfigured } from "@/lib/env";
import { DEFAULT_ZIP } from "@/lib/location";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let items = getLocalFlyerItems();
  let loggedIn = false;
  let username: string | null = null;
  let location = DEFAULT_ZIP;
  let allergies = "None";

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        loggedIn = true;
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, preferred_location, allergies")
          .eq("id", user.id)
          .maybeSingle();

        username = profile?.username ?? user.email ?? "User";
        location = profile?.preferred_location ?? DEFAULT_ZIP;
        allergies = profile?.allergies ?? "None";
      }

      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const flyer = await getCachedOrFreshItems({ postalCode: location });
        if (flyer.items.length) items = flyer.items;
      } else {
        const withCat = await supabase
          .from("items")
          .select("id, item_name, price, image, sale_story, category")
          .order("item_name");
        const dbItems =
          !withCat.error && withCat.data
            ? withCat.data
            : (
                await supabase
                  .from("items")
                  .select("id, item_name, price, image, sale_story")
                  .order("item_name")
              ).data;
        if (dbItems?.length) {
          items = dbItems
            .filter((row) => isGroceryName(row.item_name))
            .map((row) => ({
              id: row.id,
              item_name: row.item_name,
              price: Number(row.price),
              image: row.image,
              sale_story: row.sale_story,
              category: (row as { category?: string }).category,
            }));
        }
      }
    } catch (error) {
      console.error("HomePage load error:", error);
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
