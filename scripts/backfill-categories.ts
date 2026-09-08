import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createAdminClient } from "@/lib/supabase/admin";
import { categorizeGroceryItem } from "@/lib/grocery-categories";

async function main() {
  const admin = createAdminClient();

  console.log("Fetching items from Supabase...");
  const { data: items, error } = await admin
    .from("items")
    .select("id, item_name, category");

  if (error) {
    console.error("Failed to query items:", error.message);
    if (error.message.includes("category")) {
      console.log(
        "\nNOTE: The 'category' column has not been added to your database yet.\n" +
          "Please run the SQL migration in 'supabase/migrations/20260901000000_add_category_to_items.sql'\n" +
          "in your Supabase Dashboard SQL Editor first!"
      );
    }
    process.exit(1);
  }

  if (!items || items.length === 0) {
    console.log("No items found in database.");
    return;
  }

  console.log(`Found ${items.length} items. Classifying and updating...`);

  let updated = 0;
  for (const item of items) {
    const computedCategory = categorizeGroceryItem(item.item_name);
    if (item.category !== computedCategory) {
      const { error: updateErr } = await admin
        .from("items")
        .update({ category: computedCategory })
        .eq("id", item.id);

      if (updateErr) {
        console.error(`Failed to update item ${item.id} (${item.item_name}):`, updateErr.message);
      } else {
        updated++;
      }
    }
  }

  console.log(`Successfully backfilled categories for ${updated} items.`);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
