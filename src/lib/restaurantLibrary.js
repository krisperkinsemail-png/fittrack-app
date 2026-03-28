import { hasSupabaseConfig, supabase } from "./supabase";
import { computeSearchScore, isFuzzyMatch, normalizeSearchQuery } from "./search";

let fallbackLibraryPromise = null;

function formatServingSize(item) {
  return [item.serving_amount, item.serving_unit, item.serving_label].filter(Boolean).join(" ").trim();
}

function mapRestaurantRow(row) {
  return {
    id: `restaurant-${row.id}`,
    name: row.item_name,
    brand: row.brand,
    category: "restaurant",
    description: row.description || row.category || "",
    servingSize: formatServingSize(row),
    calories: Number(row.calories || 0),
    protein: Number(row.protein_g || 0),
    carbs: Number(row.carbs_g || 0),
    fat: Number(row.fat_g || 0),
    itemType: "restaurant",
    sourceType: row.source_type || "",
    sourceDate: row.source_date || "",
  };
}

async function loadFallbackLibrary() {
  if (!fallbackLibraryPromise) {
    fallbackLibraryPromise = fetch("/restaurant-library.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load restaurant library.");
        }
        return response.json();
      })
      .then((payload) =>
        Array.isArray(payload)
          ? payload.map((item) => ({
              id: `restaurant-${item.id}`,
              name: item.name,
              brand: item.brand,
              category: "restaurant",
              description: item.description || item.category || "",
              servingSize: item.servingSize || "",
              calories: Number(item.calories || 0),
              protein: Number(item.protein || 0),
              carbs: Number(item.carbs || 0),
              fat: Number(item.fat || 0),
              itemType: "restaurant",
              sourceType: item.sourceType || "",
              sourceDate: item.sourceDate || "",
            }))
          : []
      );
  }

  return fallbackLibraryPromise;
}

function matchesSearch(item, query) {
  return isFuzzyMatch(query, [item.name, item.brand, item.description, item.servingSize]);
}

export async function searchRestaurantLibrary(query) {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  if (hasSupabaseConfig) {
    const normalized = normalizeSearchQuery(trimmed);
    const { data, error } = await supabase.rpc("search_restaurant_library", {
      search_query: normalized,
      result_limit: 120,
    });

    if (!error && data) {
      return data.map(mapRestaurantRow);
    }
  }

  const library = await loadFallbackLibrary();
  return library
    .filter((item) => matchesSearch(item, trimmed))
    .sort((left, right) => {
      const rightScore = computeSearchScore(trimmed, [
        right.name,
        right.brand,
        right.description,
        right.servingSize,
      ]);
      const leftScore = computeSearchScore(trimmed, [
        left.name,
        left.brand,
        left.description,
        left.servingSize,
      ]);
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      const brandSort = left.brand.localeCompare(right.brand);
      return brandSort || left.name.localeCompare(right.name);
    })
    .slice(0, 120);
}
