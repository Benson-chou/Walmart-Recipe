import flyerJson from "@/data/flyer-items.json";
import { categorizeGroceryItem } from "@/lib/grocery-categories";
import type { FlyerItem } from "@/lib/types";

export function getLocalFlyerItems(): FlyerItem[] {
  return flyerJson.map((item, index) => ({
    id: `local-${index}`,
    item_name: item.item_name,
    price: item.price,
    image: item.image,
    sale_story: item.sale_story,
    category: categorizeGroceryItem(item.item_name),
  }));
}
