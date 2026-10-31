export const INGREDIENTS = [
  "Lemon",
  "Honey",
  "Ribena",
  "Matcha",
  "Waffle",
  "Coffee",
  "Yogurt",
  "Mango Syrup",
  "Lychee Syrup",
  "Peach Syrup",
  "Coconut Milk",
  "Fresh Milk",
  "Oat Milk",
  "Cocoa powder",
  "Blue Curaçao Syrup",
  "Spide",
  "Goofu",
  "Ovaltine",
  "Wonpao",
] as const;

export type Ingredient = (typeof INGREDIENTS)[number];

export function isIngredient(value: unknown): value is Ingredient {
  return INGREDIENTS.includes(value as Ingredient);
}
