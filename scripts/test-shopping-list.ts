import {
  buildShoppingList,
  canonicalizeIngredientName,
  formatShoppingListText,
  ingredientsMatch,
  parseIngredientLine,
} from "../lib/shopping-list";
import type { Recipe } from "../lib/types";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const recipes: Recipe[] = [
  {
    Recipe_name: "Chicken Rice Bowl",
    Ingredients: [
      "1 lb chicken breast, boneless",
      "1 cup rice",
      "2 tbsp extra virgin olive oil",
      "1/2 tsp salt",
      "1/4 tsp black pepper",
      "2 cloves garlic, minced",
    ].join("\n"),
    Instructions: "Cook it.",
  },
  {
    Recipe_name: "Garlic Chicken Skillet",
    Ingredients: [
      "8 oz chicken breast",
      "1/2 cup rice",
      "1 tbsp olive oil",
      "1 cup chicken stock",
      "1 medium onion, diced",
    ].join("\n"),
    Instructions: "Skillet.",
  },
];

const parsed = parseIngredientLine("1 1/2 cups extra virgin olive oil");
assert(parsed?.quantity === 1.5, `quantity: ${parsed?.quantity}`);
assert(parsed?.unit === "cup", `unit: ${parsed?.unit}`);
assert(
  canonicalizeIngredientName("2 tbsp extra virgin olive oil") === "olive oil",
  "canonicalize olive oil"
);

assert(ingredientsMatch("chicken breast", "Organic Chicken Breast"), "flyer chicken");
assert(!ingredientsMatch("chicken breast", "chicken stock"), "stock is not meat");
assert(!ingredientsMatch("olive oil", "olives"), "olives are not oil");
assert(ingredientsMatch("chicken stock", "chicken broth"), "stock ~ broth");

const list = buildShoppingList({
  recipes,
  assumePantry: true,
  flyerItems: [
    {
      item_name: "Yellow Onion",
      price: 1.29,
      image: "",
      sale_story: "This week",
    },
    {
      item_name: "Chicken Breast",
      price: 8.99,
      image: "",
      sale_story: "$2 off / lb",
    },
  ],
});

assert(list.recipes.length === 2, "two recipes");

const chicken = list.buy.find((item) => item.name.includes("chicken") && !item.name.includes("stock"));
assert(chicken, "chicken stays on the buy list");
assert(chicken?.deal?.item_name === "Chicken Breast", "chicken tagged with flyer deal");

assert(!list.buy.find((item) => item.name === "salt"), "salt hidden by pantry");
assert(!list.buy.find((item) => item.name === "olive oil"), "olive oil hidden by pantry");

const rice = list.buy.find((item) => item.name === "rice");
assert(rice, "rice is on the list");
assert(rice?.display.toLowerCase().includes("cup"), `rice display: ${rice?.display}`);

const stock = list.buy.find((item) => item.name.includes("stock") || item.name.includes("broth"));
assert(stock, "chicken stock still on buy list");

const onion = list.buy.find((item) => item.name.includes("onion"));
assert(onion?.deal?.item_name === "Yellow Onion", "onion matched to flyer deal");

const text = formatShoppingListText(list);
assert(text.startsWith("- "), "copy text is just list items");
assert(!text.includes("Meal plan shopping list"), "no title");
assert(!text.includes("recipes:"), "no recipe names");
assert(!text.includes("Est. flyer"), "no estimated total");

console.log("shopping list tests passed");
console.log(text);
