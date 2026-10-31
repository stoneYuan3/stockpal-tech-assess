import { isIngredient, type Ingredient } from "./ingredients";

// Keeps first-reported order and drops repeats and unknown names.
export function mergeReported(
  current: readonly Ingredient[],
  incoming: readonly unknown[],
): Ingredient[] {
  const merged = [...current];
  for (const name of incoming) {
    if (isIngredient(name) && !merged.includes(name)) merged.push(name);
  }
  return merged;
}

// Tool arguments arrive as a JSON string, and a truncated response can cut it off.
export function parseToolIngredients(argumentsJson: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(argumentsJson);
    const ingredients = (parsed as { ingredients?: unknown })?.ingredients;
    return Array.isArray(ingredients) ? ingredients : [];
  } catch {
    return [];
  }
}
