export type GroceryCategory =
  | "all"
  | "produce"
  | "meat-seafood"
  | "dairy-eggs"
  | "drinks"
  | "pantry";

export const CATEGORY_INFO: Record<GroceryCategory, { label: string; icon: string }> = {
  all: { label: "All deals", icon: "🏷️" },
  produce: { label: "Produce", icon: "🥑" },
  "meat-seafood": { label: "Meat & Seafood", icon: "🥩" },
  "dairy-eggs": { label: "Dairy & Eggs", icon: "🧀" },
  drinks: { label: "Drinks & Beverages", icon: "🥤" },
  pantry: { label: "Pantry & Bakery", icon: "🌾" },
};

/** Reject non-food merchandise occasionally misclassified by flyer aggregators (e.g. diamonds, diapers, tires, suet/mulch). */
export const NON_GROCERY_NAME_REGEX =
  /\b(diamond|diamonds|jewelry|ring|rings|necklace|necklaces|bracelet|bracelets|earring|earrings|pendant|pendants|gemstone|gemstones|gold|silver|carat|ct\.\s*t\.w|apparel|clothing|shirt|shirts|pant|pants|trouser|trousers|jacket|dress|dresses|shoe|shoes|boot|boots|sock|socks|underwear|towel|towels|pillow|pillows|mattress|blanket|blankets|rug|rugs|furniture|sofa|chair|table|tire|tires|motor oil|battery|batteries|vacuum|drill|tool|tools|tv|television|laptop|tablet|headphone|headphones|toy|toys|lego|doll|bicycle|shampoo|conditioner|soap|body wash|lotion|cosmetic|perfume|cologne|lipstick|makeup|diaper|diapers|training pants|tampon|tampons|detergent|bleach|suet\b|bird seed|bird food|potting soil|fertilizer|lawn care|cat food|dog food|pet food|cat litter|wet food)\b|\w*mulch/i;

export function isGroceryName(name: string): boolean {
  if (!name || !name.trim()) return false;
  if (NON_GROCERY_NAME_REGEX.test(name)) return false;
  return true;
}

/**
 * Classifies an item into one of the 5 aisles.
 * If a persistedCategory is already stored in the DB, it respects that category.
 */
export function categorizeGroceryItem(
  name: string,
  persistedCategory?: string | null
): GroceryCategory {
  if (
    persistedCategory &&
    persistedCategory in CATEGORY_INFO &&
    persistedCategory !== "all"
  ) {
    return persistedCategory as GroceryCategory;
  }

  const lower = name.toLowerCase();

  // 1. Definite Pantry Condiments & Cooking Liquids (e.g. Apple Cider Vinegar, Red Wine Vinegar, Cooking Wine)
  if (/\b(vinegar|cooking wine)\b/i.test(lower)) {
    return "pantry";
  }

  // 2. Drinks Exclusions: food items using beverage/water/alcohol words in culinary or bakery context
  const isDrinkExcluded =
    /\b(water chestnut|water chestnuts|water cracker|water crackers|coffee cake|tea biscuit|tea biscuits|beer batter|beer battered|beer brat|beer brats|wine cheese|whiskey cheese)\b/i.test(
      lower
    );

  // 3. Drinks & Beverages: sports drinks, energy drinks, protein drinks, water, seltzer, soda, juices, coffee, tea, alcohol
  if (
    !isDrinkExcluded &&
    (/\b(drinks?|beverages?|refreshers?|hydration|electrolytes?|electrolit|drink mix)\b/i.test(lower) ||
      /\b(gator\w*|powerade|bodyarmor|prime hydration|prime energy)\b/i.test(lower) ||
      /\b(celsius|monster\b|red bull|rockstar|c4\b|alani\b|alani nu|bucked up|ghost energy|reign\b|bang energy|nos energy|amp energy)\b/i.test(lower) ||
      /\b(protein (shake|shakes|drink|drinks)|boost\b|ensure\b|fairlife|muscle milk|premier protein|orgain)\b/i.test(lower) ||
      /\b(coffee|cold brew|k-cup|k cup|kcup|ground coffee|whole bean|espresso|latte|cappuccino|macchiato|frappuccino|frappe)\b/i.test(lower) ||
      /\b(starbucks|dunkin|mccafe|folgers|maxwell house|peet's|peets|lavazza|green mountain|original donut shop|caribou)\b/i.test(lower) ||
      /\b(tea|iced tea|green tea|black tea|herbal tea|matcha|chai|snapple|pure leaf|brisk\b|gold peak|peace tea|honest tea|tazo|twinings|bigelow)\b/i.test(lower) ||
      /\b(soda|soft drink|carbonated|\bpop\b|coke\b|coca[- ]cola|pepsi|sprite\b|dr pepper|dr\. pepper|mountain dew|mtn dew|7up|7-up|ginger ale|canada dry|fanta|crush\b|squirt\b|rc cola|a&w\b|barq's|root beer|cream soda|poppi\b|olipop)\b/i.test(lower) ||
      /\b(juice|juices|lemonade|limeade|fruit punch|capri sun|kool[- ]aid|tang\b|simply orange|tropicana|minute maid|ocean spray|v8\b|smoothie|kombucha)\b/i.test(lower) ||
      /\b(water|sparkling water|spring water|purified water|mineral water|drinking water|seltzer|club soda|tonic water)\b/i.test(lower) ||
      /\b(bubblr|liquid death|la croix|lacroix|perrier|san pellegrino|pellegrino|topo chico|smartwater|dasani|aquafina|poland spring|fiji)\b/i.test(lower) ||
      /\b(beer|beers|ale\b|ales\b|lager|ipa\b|stout|pilsner|hard seltzer|cider\b|malt\b)\b/i.test(lower) ||
      /\b(budweiser|bud light|coors|coors light|miller lite|miller\b|michelob|ultra\b|corona\b|modelo\b|heineken|stella artois|dos equis|blue moon|samuel adams|sam adams|white claw|truly\b|twisted tea|mike's hard|smirnoff)\b/i.test(lower) ||
      /\b(wine|rosé|rose\b|chardonnay|pinot\b|cabernet|merlot|sauvignon|champagne|prosecco|cava\b|moscato|zinfandel|chianti|malbec|sangria)\b/i.test(lower) ||
      /\b(vodka|tequila|whiskey|whisky|bourbon|rum\b|gin\b|brandy|cognac|liqueur|mezcal|scotch|jim beam|maker's mark|bacardi|jose cuervo|ketel one|jack daniel)\b/i.test(lower))
  ) {
    return "drinks";
  }

  // 4. Meat & Seafood: poultry, beef, pork, fish, seafood
  if (
    /chicken|beef|steak|salmon|fish|seafood|pork|shrimp|turkey|bacon|sausage|meat|rib|ribs|lamb|tuna|cod|tilapia|fillet|fillets|patties|wings|drumstick|drumsticks|ground|ham\b|chop|chops|crab|lobster/i.test(
      lower
    )
  ) {
    return "meat-seafood";
  }

  // 5. Produce: fresh fruits, vegetables, herbs, greens, melons
  if (
    /banana|tomato|tomatoes|spinach|broccoli|avocado|avocados|apple|apples|berry|berries|strawberry|strawberries|blueberry|blueberries|raspberry|raspberries|blackberry|blackberries|grape|grapes|lettuce|salad|onion|onions|potato|potatoes|carrot|carrots|pepper|peppers|mushroom|mushrooms|cucumber|cucumbers|garlic|herb|herbs|lemon|lemons|lime|limes|orange|oranges|celery|zucchini|cabbage|kale|greens|produce|citrus|fruit|fruits|vegetable|vegetables|asparagus|corn\b|cauliflower|squash|watermelon|melon|cantaloupe|honeydew|chestnut/i.test(
      lower
    )
  ) {
    return "produce";
  }

  // 6. Dairy & Eggs: dairy products, cheeses, yogurt, butter, eggs, milk
  if (
    /cheese|cheeses|yogurt|egg\b|eggs\b|milk|butter|cream|cheddar|mozzarella|parmesan|gouda|curd|dairy|brie|feta/i.test(
      lower
    )
  ) {
    return "dairy-eggs";
  }

  // 7. Default to Pantry & Bakery (bread, rice, flour, oil, snacks, cookies, cereal, canned goods, etc.)
  return "pantry";
}

/**
 * Resolves the category at ingestion / scrape time using Flipp taxonomy if available,
 * then falling back to comprehensive name heuristics.
 */
export function resolveGroceryCategory(
  name: string,
  flippL2?: string | null
): GroceryCategory {
  if (flippL2 && /beverage/i.test(flippL2)) {
    return "drinks";
  }
  return categorizeGroceryItem(name);
}
