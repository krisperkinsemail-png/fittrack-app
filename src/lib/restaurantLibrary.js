import { getSearchMeta, isFuzzyMatch, normalizeSearchQuery } from "./search";

let fallbackLibraryPromise = null;
const queryCache = new Map();
const MAX_CACHE_ENTRIES = 60;
const EXCLUDED_RESTAURANT_CATEGORIES = new Set(["beverages", "beverage", "drinks", "drink"]);

function getCachedQuery(query) {
  if (!queryCache.has(query)) {
    return null;
  }

  const value = queryCache.get(query);
  queryCache.delete(query);
  queryCache.set(query, value);
  return value;
}

function setCachedQuery(query, results) {
  queryCache.set(query, results);
  if (queryCache.size <= MAX_CACHE_ENTRIES) {
    return;
  }

  const oldestKey = queryCache.keys().next().value;
  if (oldestKey) {
    queryCache.delete(oldestKey);
  }
}

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

function shouldExcludeRestaurantRow(row) {
  const category = String(row.category || "").trim().toLowerCase();
  return EXCLUDED_RESTAURANT_CATEGORIES.has(category);
}

function dedupeRestaurantRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    if (seen.has(row.id)) {
      return false;
    }
    seen.add(row.id);
    return true;
  });
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

  const normalized = normalizeSearchQuery(trimmed);
  const cached = getCachedQuery(normalized);
  if (cached) {
    return cached;
  }

  if (hasSupabaseConfig) {
    const fastResult = await supabase
      .from("restaurant_library")
      .select(
        "id, brand, item_name, category, description, serving_amount, serving_unit, serving_label, calories, protein_g, carbs_g, fat_g, source_type, source_date"
      )
      .or(
        `normalized_search_text.ilike.%${normalized}%,brand.ilike.%${trimmed}%,item_name.ilike.%${trimmed}%`
      )
      .order("brand")
      .order("item_name")
      .limit(40);

    if (!fastResult.error && fastResult.data?.length >= 12) {
      const mapped = fastResult.data.filter((row) => !shouldExcludeRestaurantRow(row)).map(mapRestaurantRow);
      setCachedQuery(normalized, mapped);
      return mapped;
    }

    const fuzzyResult = await supabase.rpc("search_restaurant_library", {
      search_query: normalized,
      result_limit: 80,
    });

    if (!fuzzyResult.error && fuzzyResult.data) {
      const merged = dedupeRestaurantRows([
        ...(fastResult.error || !fastResult.data ? [] : fastResult.data),
        ...fuzzyResult.data,
      ])
        .filter((row) => !shouldExcludeRestaurantRow(row))
        .map(mapRestaurantRow);
      setCachedQuery(normalized, merged);
      return merged;
    }

    if (!fastResult.error && fastResult.data) {
      const mapped = fastResult.data.filter((row) => !shouldExcludeRestaurantRow(row)).map(mapRestaurantRow);
      setCachedQuery(normalized, mapped);
      return mapped;
    }
  }

  const library = await loadFallbackLibrary();
  const results = library
    .filter((item) => !shouldExcludeRestaurantRow(item))
    .map((item) => ({ item, meta: getSearchMeta(trimmed, [item.name, item.brand, item.description, item.servingSize]) }))
    .filter(({ meta }) => meta.tier > 0)
    .sort((left, right) => {
      if (right.meta.tier !== left.meta.tier) {
        return right.meta.tier - left.meta.tier;
      }
      if (right.meta.score !== left.meta.score) {
        return right.meta.score - left.meta.score;
      }
      const brandSort = left.item.brand.localeCompare(right.item.brand);
      return brandSort || left.item.name.localeCompare(right.item.name);
    })
    .map(({ item }) => item)
    .slice(0, 80);
  setCachedQuery(normalized, results);
  return results;
}
