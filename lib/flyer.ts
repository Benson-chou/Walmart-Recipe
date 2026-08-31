import flyerJson from "@/data/flyer-items.json";
import type { FlyerItem } from "@/lib/types";

export function getLocalFlyerItems(): FlyerItem[] {
  return flyerJson.map((item, index) => ({
    id: `local-${index}`,
    item_name: item.item_name,
    price: item.price,
    image: item.image,
    sale_story: item.sale_story,
  }));
}
