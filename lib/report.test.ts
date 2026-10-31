import { describe, expect, it } from "vitest";
import { mergeReported, parseToolIngredients } from "./report";

describe("mergeReported", () => {
  it("appends in reported order", () => {
    expect(mergeReported(["Lemon"], ["Honey", "Ribena"])).toEqual([
      "Lemon",
      "Honey",
      "Ribena",
    ]);
  });

  it("removes duplicates across and within reports", () => {
    expect(mergeReported(["Lemon"], ["Lemon", "Honey", "Honey"])).toEqual([
      "Lemon",
      "Honey",
    ]);
  });

  it("drops names that are not on the ingredient list", () => {
    expect(mergeReported([], ["Caocao", "Milk", 7, "Oat Milk"])).toEqual([
      "Oat Milk",
    ]);
  });

  it("does not mutate the current list", () => {
    const current = ["Lemon"] as const;
    mergeReported(current, ["Honey"]);
    expect(current).toEqual(["Lemon"]);
  });
});

describe("parseToolIngredients", () => {
  it("reads the ingredients array", () => {
    expect(parseToolIngredients('{"ingredients":["Lemon","Honey"]}')).toEqual([
      "Lemon",
      "Honey",
    ]);
  });

  it.each(['{"ingredients":["Lem', "null", '{"ingredients":"Lemon"}', "{}"])(
    "returns nothing for %s",
    (input) => {
      expect(parseToolIngredients(input)).toEqual([]);
    },
  );
});
