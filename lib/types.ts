export type FlyerItem = {
  id?: string;
  item_name: string;
  price: number;
  image: string;
  sale_story: string;
};

export type Recipe = {
  id?: string;
  Recipe_name: string;
  Ingredients: string;
  Instructions: string;
};

export type Profile = {
  id: string;
  username: string;
  preferred_location: string;
  allergies: string;
};
