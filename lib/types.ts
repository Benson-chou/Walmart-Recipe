export type FlyerItem = {
  id?: string;
  item_name: string;
  price: number;
  image: string;
  sale_story: string;
  category?: string;
};

export type RecipeSource = "retrieved" | "generated";

export type Recipe = {
  id?: string;
  Recipe_name: string;
  Ingredients: string;
  Instructions: string;
  source?: RecipeSource;
  score?: number;
};

export type Profile = {
  id: string;
  username: string;
  preferred_location: string;
  allergies: string;
};
