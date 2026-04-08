import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthGate";
import { FOOD_LIBRARY } from "../lib/foodLibrary";
import { loadFoodLibraryUsage, recordFoodLibraryUsage } from "../lib/libraryUsage";
import { searchRestaurantLibrary } from "../lib/restaurantLibrary";
import { computeSearchScore, getSearchMeta, isFuzzyMatch } from "../lib/search";
import { formatLongDate } from "../lib/date";

const EMPTY_FORM = {
  foodName: "",
  servingSize: "",
  servingAmount: "",
  servingUnit: "",
  servingNote: "",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
};

const QUICK_SEARCH_LIMIT = 50;
const WATER_PRESETS = [8, 12, 16, 24, 32];

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function canAccessLibraryItem(item, userEmail) {
  if (!item.allowedEmails?.length) {
    return true;
  }

  const normalizedUserEmail = normalizeEmail(userEmail);
  return item.allowedEmails.some((email) => normalizeEmail(email) === normalizedUserEmail);
}

function formatDecimal(value) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatServing(amount, unit, note = "") {
  return [formatDecimal(Number(amount)), unit.trim(), note.trim()].filter(Boolean).join(" ");
}

function scalePreset(item, nextAmount) {
  const ratio = Number(nextAmount) / Number(item.baseAmount || 1);
  return {
    calories: String(Math.round(item.calories * ratio)),
    protein: formatDecimal(item.protein * ratio),
    carbs: formatDecimal(item.carbs * ratio),
    fat: formatDecimal(item.fat * ratio),
  };
}

function parseServingAmount(value) {
  const trimmed = value.trim();

  if (/^\d+\/\d+$/.test(trimmed)) {
    const [numerator, denominator] = trimmed.split("/").map(Number);
    if (denominator) {
      return numerator / denominator;
    }
  }

  if (/^\d+\s+\d+\/\d+$/.test(trimmed)) {
    const [whole, fraction] = trimmed.split(/\s+/);
    const [numerator, denominator] = fraction.split("/").map(Number);
    if (denominator) {
      return Number(whole) + numerator / denominator;
    }
  }

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : NaN;
}

function getScalablePreset(item) {
  if (item.isScalable) {
    return item;
  }

  if (!item?.servingSize?.trim()) {
    return null;
  }

  const match = item.servingSize
    .trim()
    .match(/^(\d+(?:\.\d+)?|\d+\/\d+|\d+\s+\d+\/\d+)\s+(\S+)(?:\s+(.*))?$/);
  if (!match) {
    return null;
  }

  const [, amount, unit, note = ""] = match;
  const baseAmount = parseServingAmount(amount);

  if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
    return null;
  }

  return {
    ...item,
    isScalable: true,
    baseAmount,
    baseUnit: unit,
    servingNote: note,
  };
}

function inferSavedTemplateType(item) {
  if (item.templateType === "food" || item.templateType === "meal") {
    return item.templateType;
  }

  const normalizedName = item.name.trim().toLowerCase();
  const foodLibraryMatch = FOOD_LIBRARY.find(
    (libraryItem) => libraryItem.name.trim().toLowerCase() === normalizedName
  );

  if (foodLibraryMatch) {
    return "food";
  }

  const normalizedServing = item.servingSize.trim().toLowerCase();
  if (
    /^(?:\d*\.?\d+)\s+(?:oz|g|gram|grams|cup|cups|tbsp|tsp|slice|slices|egg|eggs|stick|sticks|banana|avocado|tortilla|tortillas|link|links|patty|patties|serving|servings)\b/.test(
      normalizedServing
    )
  ) {
    return "food";
  }

  return "meal";
}

function matchesSearch(item, term) {
  return isFuzzyMatch(term, [item.name, item.brand, item.servingSize, item.description]);
}

function getItemSearchMeta(item, term) {
  return getSearchMeta(term, [item.name, item.brand, item.servingSize, item.description]);
}

function getQuickSearchMeta(item, foodTerm, restaurantTerm) {
  const foodMeta = foodTerm
    ? getSearchMeta(foodTerm, [item.name, item.servingSize, item.description])
    : { tier: 3, score: 1 };
  const brandMeta = restaurantTerm
    ? getSearchMeta(restaurantTerm, [item.brand || ""])
    : { tier: 3, score: 1 };

  if (foodMeta.tier === 0 || brandMeta.tier === 0) {
    return { tier: 0, score: 0, foodMeta, brandMeta };
  }

  return {
    tier: Math.min(foodMeta.tier, brandMeta.tier),
    score: foodMeta.score * 0.75 + brandMeta.score * 0.25,
    foodMeta,
    brandMeta,
  };
}

function getSourcePriority(item) {
  switch (item.itemType) {
    case "saved-food":
      return 0;
    case "food":
      return 1;
    case "meal":
      return 2;
    case "restaurant":
      return 3;
    default:
      return 4;
  }
}

function compareItems(left, right, search = "", usageCounts = {}) {
  const leftMeta = search ? getItemSearchMeta(left, search) : { tier: 0, score: 0 };
  const rightMeta = search ? getItemSearchMeta(right, search) : { tier: 0, score: 0 };

  if (search && rightMeta.tier !== leftMeta.tier) {
    return rightMeta.tier - leftMeta.tier;
  }

  if (search && rightMeta.score !== leftMeta.score) {
    return rightMeta.score - leftMeta.score;
  }

  const leftPriority = getSourcePriority(left);
  const rightPriority = getSourcePriority(right);
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  const rightUsage = usageCounts[right.id] || 0;
  const leftUsage = usageCounts[left.id] || 0;
  if (rightUsage !== leftUsage) {
    return rightUsage - leftUsage;
  }

  return left.name.localeCompare(right.name);
}

function hasRestaurantIntent(foodTerm, restaurantTerm, restaurantMatches = []) {
  if (restaurantTerm.length >= 2) {
    return true;
  }

  if (foodTerm.length < 2) {
    return false;
  }

  return restaurantMatches.some((item) => {
    const brandMeta = getSearchMeta(foodTerm, [item.brand || ""]);
    const nameMeta = getSearchMeta(foodTerm, [item.name || ""]);
    return brandMeta.tier >= 3 || nameMeta.tier >= 3;
  });
}

export function FoodLogSection({
  selectedDate,
  entries,
  allEntries,
  mealTemplates,
  waterOunces,
  onAddEntry,
  onAddEntries,
  onUpdateEntry,
  onDeleteEntry,
  onSaveMeal,
  onDeleteMeal,
  onAddWater,
  onResetWater,
}) {
  const { session } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editingPreset, setEditingPreset] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [search, setSearch] = useState("");
  const [quickSearch, setQuickSearch] = useState("");
  const [quickRestaurantSearch, setQuickRestaurantSearch] = useState("");
  const [quickSearchResults, setQuickSearchResults] = useState([]);
  const [quickSearchStatus, setQuickSearchStatus] = useState("idle");
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const [isFoodLogOpen, setIsFoodLogOpen] = useState(false);
  const [hasTriedFoodSubmit, setHasTriedFoodSubmit] = useState(false);
  const [isDayHistoryOpen, setIsDayHistoryOpen] = useState(false);
  const [isQuickPicksOpen, setIsQuickPicksOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [usageCounts, setUsageCounts] = useState(() => loadFoodLibraryUsage());
  const [restaurantLibrary, setRestaurantLibrary] = useState([]);
  const [restaurantStatus, setRestaurantStatus] = useState("idle");
  const [restaurantError, setRestaurantError] = useState("");
  const deferredSearch = useDeferredValue(search);
  const deferredQuickSearch = useDeferredValue(quickSearch);
  const deferredQuickRestaurantSearch = useDeferredValue(quickRestaurantSearch);
  const quickSearchRef = useRef(null);

  const totalCalories = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.calories, 0),
    [entries]
  );
  const dayMacroTotals = useMemo(
    () =>
      entries.reduce(
        (totals, entry) => ({
          protein: totals.protein + entry.protein,
          carbs: totals.carbs + entry.carbs,
          fat: totals.fat + entry.fat,
        }),
        { protein: 0, carbs: 0, fat: 0 }
      ),
    [entries]
  );

  const previousDayEntries = useMemo(() => {
    const previousDate = new Date(`${selectedDate}T12:00:00`);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousDateString = previousDate.toISOString().slice(0, 10);

    return allEntries.filter((entry) => entry.date === previousDateString);
  }, [allEntries, selectedDate]);

  const accessibleFoodLibrary = useMemo(
    () =>
      FOOD_LIBRARY.filter((item) => canAccessLibraryItem(item, session?.user?.email)),
    [session?.user?.email]
  );

  useEffect(() => {
    if (categoryFilter !== "restaurant") {
      return;
    }

    let isMounted = true;
    const trimmedSearch = deferredSearch.trim();

    if (trimmedSearch.length < 2) {
      setRestaurantLibrary([]);
      setRestaurantStatus("idle");
      setRestaurantError("");
      return () => {
        isMounted = false;
      };
    }

    setRestaurantStatus("loading");
    const timeoutId = window.setTimeout(() => {
      searchRestaurantLibrary(trimmedSearch)
      .then((results) => {
        if (!isMounted) {
          return;
        }

        startTransition(() => {
          setRestaurantLibrary(results);
          setRestaurantStatus("ready");
          setRestaurantError("");
        });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        startTransition(() => {
          setRestaurantStatus("error");
          setRestaurantError(error.message || "Failed to load restaurant library.");
        });
      });
    }, 180);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [categoryFilter, deferredSearch]);

  const quickPickLibrary = useMemo(() => {
    const savedMeals = mealTemplates.map((meal) => ({
      ...meal,
      templateType: inferSavedTemplateType(meal),
      category: inferSavedTemplateType(meal) === "food" ? "food" : "meal",
      itemType: inferSavedTemplateType(meal) === "food" ? "saved-food" : "meal",
      isScalable: false,
    }));

    return [...savedMeals, ...accessibleFoodLibrary.map((item) => ({ ...item, itemType: "food" }))];
  }, [accessibleFoodLibrary, mealTemplates]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!quickSearchRef.current?.contains(event.target)) {
        setIsQuickSearchOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    const trimmedSearch = deferredQuickSearch.trim();
    const trimmedRestaurantSearch = deferredQuickRestaurantSearch.trim();
    const hasEnoughInput = trimmedSearch.length >= 2 || trimmedRestaurantSearch.length >= 2;
    const restaurantOnlyMode = trimmedRestaurantSearch.length >= 2;

    if (!isQuickSearchOpen || !hasEnoughInput) {
      setQuickSearchResults([]);
      if (!hasEnoughInput) {
        setQuickSearchStatus("idle");
      }
      return;
    }

    let isMounted = true;

    const localMatches = restaurantOnlyMode
      ? []
      : quickPickLibrary
          .map((item) => ({ item, meta: getQuickSearchMeta(item, trimmedSearch, trimmedRestaurantSearch) }))
          .filter(({ meta, item }) => {
            if (trimmedRestaurantSearch && !item.brand) {
              return false;
            }
            return meta.tier >= 2;
          })
          .sort((left, right) => {
            if (right.meta.tier !== left.meta.tier) {
              return right.meta.tier - left.meta.tier;
            }

            if (right.meta.score !== left.meta.score) {
              return right.meta.score - left.meta.score;
            }

            return compareItems(left.item, right.item, trimmedSearch, usageCounts);
          })
          .map(({ item }) => item)
          .slice(0, QUICK_SEARCH_LIMIT);

    setQuickSearchResults(localMatches);
    setQuickSearchStatus(localMatches.length ? "ready" : "loading");

    const timeoutId = window.setTimeout(() => {
      searchRestaurantLibrary(trimmedRestaurantSearch || trimmedSearch)
        .then((restaurantMatches) => {
          if (!isMounted) {
            return;
          }

          const restaurantIntent = hasRestaurantIntent(
            trimmedSearch,
            trimmedRestaurantSearch,
            restaurantMatches
          );
          if (!restaurantIntent) {
            startTransition(() => {
              setQuickSearchResults(localMatches);
              setQuickSearchStatus("ready");
            });
            return;
          }

          const seen = new Set(localMatches.map((item) => item.id));
          const mergedResults = [...localMatches];
          const strictRestaurantMatches = restaurantMatches.filter((item) => {
            const brandMeta = trimmedRestaurantSearch
              ? getSearchMeta(trimmedRestaurantSearch, [item.brand || ""])
              : { tier: 3 };
            const foodMeta = trimmedSearch
              ? getSearchMeta(trimmedSearch, [item.name, item.servingSize, item.description])
              : { tier: 3 };

            return brandMeta.tier >= 2 && foodMeta.tier >= 2;
          });

          const sourceResults = strictRestaurantMatches;
          for (const item of sourceResults) {
            if (seen.has(item.id)) {
              continue;
            }
            mergedResults.push(item);
            seen.add(item.id);
            if (mergedResults.length >= QUICK_SEARCH_LIMIT) {
              break;
            }
          }

          mergedResults.sort((left, right) => {
            const leftMeta = getQuickSearchMeta(left, trimmedSearch, trimmedRestaurantSearch);
            const rightMeta = getQuickSearchMeta(right, trimmedSearch, trimmedRestaurantSearch);

            if (rightMeta.tier !== leftMeta.tier) {
              return rightMeta.tier - leftMeta.tier;
            }

            if (rightMeta.score !== leftMeta.score) {
              return rightMeta.score - leftMeta.score;
            }

            return compareItems(left, right, trimmedSearch, usageCounts);
          });

          startTransition(() => {
            setQuickSearchResults(mergedResults);
            setQuickSearchStatus("ready");
          });
        })
        .catch(() => {
          if (!isMounted) {
            return;
          }
          setQuickSearchStatus("ready");
        });
    }, 150);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [
    deferredQuickRestaurantSearch,
    deferredQuickSearch,
    isQuickSearchOpen,
    quickPickLibrary,
    usageCounts,
  ]);

  const filteredLibrary = useMemo(() => {
    if (categoryFilter === "restaurant") {
      return restaurantLibrary;
    }

    return quickPickLibrary
      .map((item) => ({ item, meta: getItemSearchMeta(item, search) }))
      .filter(({ item, meta }) => {
        const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
        return matchesCategory && meta.tier > 0;
      })
      .sort((left, right) => {
        if (search && right.meta.tier !== left.meta.tier) {
          return right.meta.tier - left.meta.tier;
        }

        if (search && right.meta.score !== left.meta.score) {
          return right.meta.score - left.meta.score;
        }

        return compareItems(left.item, right.item, search, usageCounts);
      })
      .map(({ item }) => item);
  }, [categoryFilter, quickPickLibrary, restaurantLibrary, search, usageCounts]);

  const shouldShowQuickPicksCard =
    categoryFilter !== "restaurant" && search.trim().length === 0;
  const quickPickPreview = useMemo(() => filteredLibrary.slice(0, 8), [filteredLibrary]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setSelectedPreset(null);
    setHasTriedFoodSubmit(false);
    setQuickSearch("");
    setQuickRestaurantSearch("");
    setQuickSearchResults([]);
    setQuickSearchStatus("idle");
    setIsQuickSearchOpen(false);
  }

  function loadPreset(item) {
    const scalablePreset = getScalablePreset(item);
    setUsageCounts(recordFoodLibraryUsage(item.id));
    setSelectedPreset(scalablePreset);
    setQuickSearch(item.name);
    setQuickRestaurantSearch(item.brand || "");
    setQuickSearchResults([]);
    setQuickSearchStatus("idle");
    setIsQuickSearchOpen(false);
    setForm({
      foodName: item.name,
      servingSize: item.servingSize,
      servingAmount: scalablePreset?.baseAmount ? String(scalablePreset.baseAmount) : "",
      servingUnit: scalablePreset?.baseUnit || "",
      servingNote: scalablePreset?.servingNote || "",
      calories: String(item.calories),
      protein: String(item.protein),
      carbs: String(item.carbs),
      fat: String(item.fat),
    });
  }

  function buildPayload() {
    const servingSize = selectedPreset?.isScalable
      ? formatServing(form.servingAmount, form.servingUnit, form.servingNote)
      : form.servingSize.trim();

    return {
      date: selectedDate,
      foodName: form.foodName.trim(),
      servingSize,
      calories: Number(form.calories),
      protein: Number(form.protein),
      carbs: Number(form.carbs),
      fat: Number(form.fat),
    };
  }

  function canSaveCurrentForm() {
    return (
      form.foodName.trim() &&
      (selectedPreset?.isScalable
        ? Number(form.servingAmount) > 0 && form.servingUnit.trim()
        : form.servingSize.trim()) &&
      form.calories !== "" &&
      form.protein !== "" &&
      form.carbs !== "" &&
      form.fat !== ""
    );
  }

  function saveTemplate(payload, templateType) {
    onSaveMeal({
      name: payload.foodName,
      templateType,
      servingSize: payload.servingSize,
      calories: payload.calories,
      protein: payload.protein,
      carbs: payload.carbs,
      fat: payload.fat,
    });
  }

  function submitEntry({ saveTemplateType = null }) {
    if (!canSaveCurrentForm()) {
      setHasTriedFoodSubmit(true);
      return;
    }

    setHasTriedFoodSubmit(false);
    const payload = buildPayload();
    onAddEntry(payload);

    if (saveTemplateType) {
      saveTemplate(payload, saveTemplateType);
    }

    resetForm();
  }

  function handleSubmit(event) {
    event.preventDefault();
    submitEntry({ saveTemplateType: null });
  }

  function copyYesterday() {
    if (!previousDayEntries.length) {
      return;
    }

    onAddEntries(
      previousDayEntries.map((entry) => ({
        date: selectedDate,
        foodName: entry.foodName,
        servingSize: entry.servingSize,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
      }))
    );
  }

  function startEdit(entry) {
    const scalablePreset = getScalablePreset({
      id: entry.id,
      name: entry.foodName,
      servingSize: entry.servingSize,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
    });

    setEditingId(entry.id);
    setEditingPreset(scalablePreset);
    setEditForm({
      foodName: entry.foodName,
      servingSize: entry.servingSize,
      servingAmount: scalablePreset?.baseAmount ? String(scalablePreset.baseAmount) : "",
      servingUnit: scalablePreset?.baseUnit || "",
      servingNote: scalablePreset?.servingNote || "",
      calories: String(entry.calories),
      protein: String(entry.protein),
      carbs: String(entry.carbs),
      fat: String(entry.fat),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingPreset(null);
    setEditForm(EMPTY_FORM);
  }

  function handleEditServingAmountChange(value) {
    if (!editingPreset?.isScalable) {
      setEditForm((current) => ({ ...current, servingAmount: value }));
      return;
    }

    if (value === "") {
      setEditForm((current) => ({
        ...current,
        servingAmount: "",
        calories: "",
        protein: "",
        carbs: "",
        fat: "",
      }));
      return;
    }

    const scaled = scalePreset(editingPreset, value);
    setEditForm((current) => ({
      ...current,
      servingAmount: value,
      ...scaled,
    }));
  }

  function canSaveEditForm() {
    return (
      editForm.foodName.trim() &&
      (editingPreset?.isScalable
        ? Number(editForm.servingAmount) > 0 && editForm.servingUnit.trim()
        : editForm.servingSize.trim()) &&
      editForm.calories !== "" &&
      editForm.protein !== "" &&
      editForm.carbs !== "" &&
      editForm.fat !== ""
    );
  }

  function saveEdit() {
    if (!editingId || !canSaveEditForm()) {
      return;
    }

    const servingSize = editingPreset?.isScalable
      ? formatServing(editForm.servingAmount, editForm.servingUnit, editForm.servingNote)
      : editForm.servingSize.trim();

    onUpdateEntry(editingId, {
      date: selectedDate,
      foodName: editForm.foodName.trim(),
      servingSize,
      calories: Number(editForm.calories),
      protein: Number(editForm.protein),
      carbs: Number(editForm.carbs),
      fat: Number(editForm.fat),
    });

    cancelEdit();
  }

  function handleServingAmountChange(value) {
    if (!selectedPreset?.isScalable) {
      setForm((current) => ({ ...current, servingAmount: value }));
      return;
    }

    if (value === "") {
      setForm((current) => ({
        ...current,
        servingAmount: "",
        calories: "",
        protein: "",
        carbs: "",
        fat: "",
      }));
      return;
    }

    const scaled = scalePreset(selectedPreset, value);
    setForm((current) => ({
      ...current,
      servingAmount: value,
      ...scaled,
    }));
  }

  function quickAddItem(item) {
    setUsageCounts(recordFoodLibraryUsage(item.id));
    onAddEntry({
      date: selectedDate,
      foodName: item.name,
      servingSize: item.servingSize,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
    });
    resetForm();
  }

  function isMainFieldMissing(field) {
    switch (field) {
      case "foodName":
        return !form.foodName.trim();
      case "serving":
        return selectedPreset?.isScalable
          ? !(Number(form.servingAmount) > 0 && form.servingUnit.trim())
          : !form.servingSize.trim();
      case "servingAmount":
        return !(Number(form.servingAmount) > 0);
      case "servingUnit":
        return !form.servingUnit.trim();
      case "calories":
        return form.calories === "";
      case "protein":
        return form.protein === "";
      case "carbs":
        return form.carbs === "";
      case "fat":
        return form.fat === "";
      default:
        return false;
    }
  }

  return (
    <div className="section-stack">
      <section className="card water-tracker-card">
        <div className="section-heading water-tracker-heading">
          <p className="eyebrow">Water tracker</p>
          <h2>{waterOunces} oz</h2>
        </div>

        <div className="water-tracker-grid">
          {WATER_PRESETS.map((ounces) => (
            <button
              key={ounces}
              type="button"
              className="secondary-button water-preset-button"
              onClick={() => onAddWater(ounces)}
            >
              +{ounces} oz
            </button>
          ))}
        </div>

        <div className="button-row water-tracker-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onResetWater}
            disabled={!waterOunces}
          >
            Reset day
          </button>
        </div>
      </section>

      <section className="card food-log-card">
        <button
          type="button"
          className="food-log-toggle"
          onClick={() => setIsFoodLogOpen((current) => !current)}
          aria-expanded={isFoodLogOpen}
        >
          <div className="section-heading food-log-heading">
            <div>
              <p className="eyebrow">Food logging</p>
              <h2>Add food entry</h2>
            </div>
            <div className="food-log-toggle__summary">
              <p className="muted">Selected day: {formatLongDate(selectedDate)}</p>
              <p className="muted">Tap to add food</p>
            </div>
          </div>
          <span className="food-log-toggle__chevron">{isFoodLogOpen ? "−" : "+"}</span>
        </button>

        {isFoodLogOpen ? (
          <>
            <div className="food-log-content">
              <div className="food-log-search" ref={quickSearchRef}>
                <p className="eyebrow">Quick Search</p>
                <p className="muted">Selected day: {formatLongDate(selectedDate)}</p>
                <div className="food-log-search__fields">
                  <label className="food-log-search__label">
                    <span className="sr-only">Search foods</span>
                    <input
                      value={quickSearch}
                      onChange={(event) => {
                        setQuickSearch(event.target.value);
                        setIsQuickSearchOpen(true);
                      }}
                      onFocus={() => setIsQuickSearchOpen(true)}
                      placeholder="Food"
                    />
                  </label>
                  <label className="food-log-search__label">
                    <span className="sr-only">Search restaurant</span>
                    <input
                      value={quickRestaurantSearch}
                      onChange={(event) => {
                        setQuickRestaurantSearch(event.target.value);
                        setIsQuickSearchOpen(true);
                      }}
                      onFocus={() => setIsQuickSearchOpen(true)}
                      placeholder="Restaurant"
                    />
                  </label>
                </div>
                {isQuickSearchOpen &&
                (quickSearch.trim().length >= 2 || quickRestaurantSearch.trim().length >= 2) ? (
                  <div className="food-log-search__dropdown">
                    {quickSearchResults.length ? (
                      <div className="food-log-search__results">
                        {quickSearchResults.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="food-log-search__result"
                            onClick={() => loadPreset(item)}
                          >
                            <span>
                              <strong>{item.name}</strong>
                              <small>
                                {item.brand ? `${item.brand} • ` : ""}
                                {item.servingSize}
                              </small>
                            </span>
                            <span>{item.calories} cal</span>
                          </button>
                        ))}
                      </div>
                    ) : quickSearchStatus === "loading" ? (
                      <div className="food-log-search__empty">Searching...</div>
                    ) : (
                      <div className="food-log-search__empty">No matches found.</div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="button-row food-log-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={copyYesterday}
                disabled={!previousDayEntries.length}
              >
                Copy yesterday
              </button>
            </div>

            <form className="form-grid food-log-content" onSubmit={handleSubmit}>
          <label>
            Food name
            {hasTriedFoodSubmit && isMainFieldMissing("foodName") ? (
              <span className="required-indicator">*</span>
            ) : null}
            <input
              value={form.foodName}
              onChange={(event) => setForm((current) => ({ ...current, foodName: event.target.value }))}
              placeholder="Greek yogurt"
              required
            />
          </label>

          {selectedPreset?.isScalable ? (
            <>
              <div className="compact-grid compact-grid--two">
                <label>
                  Amount
                  {hasTriedFoodSubmit && isMainFieldMissing("servingAmount") ? (
                    <span className="required-indicator">*</span>
                  ) : null}
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    value={form.servingAmount}
                    onChange={(event) => handleServingAmountChange(event.target.value)}
                    required
                  />
                </label>

                <label>
                  Unit
                  {hasTriedFoodSubmit && isMainFieldMissing("servingUnit") ? (
                    <span className="required-indicator">*</span>
                  ) : null}
                  <input value={form.servingUnit} readOnly />
                </label>
              </div>

              <p className="muted">
                Auto-scaling from base serving: {selectedPreset.servingSize}
              </p>
            </>
          ) : (
            <label>
              Serving size
              {hasTriedFoodSubmit && isMainFieldMissing("serving") ? (
                <span className="required-indicator">*</span>
              ) : null}
              <input
                value={form.servingSize}
                onChange={(event) =>
                  setForm((current) => ({ ...current, servingSize: event.target.value }))
                }
                placeholder="1 cup"
                required
              />
            </label>
          )}

          <div className="compact-grid compact-grid--mobile-two">
            <label>
              Calories
              {hasTriedFoodSubmit && isMainFieldMissing("calories") ? (
                <span className="required-indicator">*</span>
              ) : null}
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={form.calories}
                onChange={(event) =>
                  setForm((current) => ({ ...current, calories: event.target.value }))
                }
                disabled={selectedPreset?.isScalable}
                required
              />
            </label>

            <label>
              Protein (g)
              {hasTriedFoodSubmit && isMainFieldMissing("protein") ? (
                <span className="required-indicator">*</span>
              ) : null}
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={form.protein}
                onChange={(event) =>
                  setForm((current) => ({ ...current, protein: event.target.value }))
                }
                disabled={selectedPreset?.isScalable}
                required
              />
            </label>

            <label>
              Carbs (g)
              {hasTriedFoodSubmit && isMainFieldMissing("carbs") ? (
                <span className="required-indicator">*</span>
              ) : null}
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={form.carbs}
                onChange={(event) =>
                  setForm((current) => ({ ...current, carbs: event.target.value }))
                }
                disabled={selectedPreset?.isScalable}
                required
              />
            </label>

            <label>
              Fat (g)
              {hasTriedFoodSubmit && isMainFieldMissing("fat") ? (
                <span className="required-indicator">*</span>
              ) : null}
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={form.fat}
                onChange={(event) =>
                  setForm((current) => ({ ...current, fat: event.target.value }))
                }
                disabled={selectedPreset?.isScalable}
                required
              />
            </label>
          </div>

          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              onClick={() => submitEntry({ saveTemplateType: null })}
            >
              Add Food
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => submitEntry({ saveTemplateType: "food" })}
            >
              Add Food + Save
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => submitEntry({ saveTemplateType: null })}
            >
              Add Meal
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => submitEntry({ saveTemplateType: "meal" })}
            >
              Add Meal + Save
            </button>
          </div>
            </form>
          </>
        ) : null}
      </section>

      <section className="card">
        <button
          type="button"
          className="food-history-toggle"
          onClick={() => setIsDayHistoryOpen((current) => !current)}
          aria-expanded={isDayHistoryOpen}
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">Day history</p>
              <h2>{entries.length} entries</h2>
            </div>
            <div className="food-history-summary">
              <p className="muted">{totalCalories} cal</p>
              <p className="muted">
                P {formatDecimal(dayMacroTotals.protein)} • C {formatDecimal(dayMacroTotals.carbs)} • F{" "}
                {formatDecimal(dayMacroTotals.fat)}
              </p>
            </div>
          </div>
          <span className="food-history-toggle__chevron">{isDayHistoryOpen ? "−" : "+"}</span>
        </button>

        {isDayHistoryOpen ? entries.length ? (
          <div className="food-history-content list-stack">
            {entries.map((entry) => (
              <article className="log-card" key={entry.id}>
                <div className="food-log-entry-body">
                  <div className="log-card__top">
                    <div>
                      <h3>{entry.foodName}</h3>
                      <p className="muted">{entry.servingSize}</p>
                    </div>
                    <strong>{entry.calories} cal</strong>
                  </div>
                  <p className="muted">
                    P {entry.protein}g • C {entry.carbs}g • F {entry.fat}g
                  </p>
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      onAddEntry({
                        date: selectedDate,
                        foodName: entry.foodName,
                        servingSize: entry.servingSize,
                        calories: entry.calories,
                        protein: entry.protein,
                        carbs: entry.carbs,
                        fat: entry.fat,
                      })
                    }
                  >
                    Repeat
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => startEdit(entry)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="secondary-button danger-button"
                    onClick={() => onDeleteEntry(entry.id)}
                  >
                    Delete
                  </button>
                </div>
                {editingId === entry.id ? (
                  <div className="inline-edit-panel">
                    {editingPreset?.isScalable ? (
                      <>
                        <div className="compact-grid compact-grid--two">
                          <label>
                            Quantity
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.1"
                              value={editForm.servingAmount}
                              onChange={(event) => handleEditServingAmountChange(event.target.value)}
                            />
                          </label>
                          <label>
                            Unit
                            <input value={editForm.servingUnit} readOnly />
                          </label>
                        </div>
                        <p className="muted">
                          Auto-scaling from base serving: {editingPreset.servingSize}
                        </p>
                      </>
                    ) : (
                      <label>
                        Serving size
                        <input
                          value={editForm.servingSize}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, servingSize: event.target.value }))
                          }
                        />
                      </label>
                    )}

                    <div className="compact-grid">
                      <label>
                        Calories
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={editForm.calories}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, calories: event.target.value }))
                          }
                          disabled={editingPreset?.isScalable}
                        />
                      </label>
                      <label>
                        Protein (g)
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          value={editForm.protein}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, protein: event.target.value }))
                          }
                          disabled={editingPreset?.isScalable}
                        />
                      </label>
                      <label>
                        Carbs (g)
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          value={editForm.carbs}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, carbs: event.target.value }))
                          }
                          disabled={editingPreset?.isScalable}
                        />
                      </label>
                      <label>
                        Fat (g)
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          value={editForm.fat}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, fat: event.target.value }))
                          }
                          disabled={editingPreset?.isScalable}
                        />
                      </label>
                    </div>

                    <div className="button-row">
                      <button
                        type="button"
                        className="primary-button"
                        onClick={saveEdit}
                        disabled={!canSaveEditForm()}
                      >
                        Save
                      </button>
                      <button type="button" className="secondary-button" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="food-history-content empty-panel">
            <p>No food logged for this day.</p>
          </div>
        ) : null}
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Food library</p>
            <h2>Quick-pick foods and saved meals</h2>
          </div>
          <p className="muted">Search by food title, serving, or saved meal.</p>
        </div>

        <div className="form-grid">
          <label>
            Search library
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                categoryFilter === "restaurant"
                  ? "Search chain or item name..."
                  : "Chicken, potato, yogurt..."
              }
            />
          </label>

          <div className="button-row">
            {["all", "protein", "carb", "fat", "meal", "restaurant"].map((category) => (
              <button
                key={category}
                type="button"
                className={
                  categoryFilter === category
                    ? "secondary-button is-selected-accent"
                    : "secondary-button"
                }
                onClick={() => setCategoryFilter(category)}
              >
                {category === "all"
                  ? "All"
                  : category === "meal"
                    ? "Meals"
                    : category === "restaurant"
                      ? "Restaurants"
                      : category}
              </button>
            ))}
          </div>
        </div>

        {categoryFilter === "restaurant" && restaurantStatus === "loading" ? (
          <div className="empty-panel">
            <p>Loading restaurant library...</p>
          </div>
        ) : null}

        {categoryFilter === "restaurant" && restaurantStatus === "error" ? (
          <div className="empty-panel">
            <p>{restaurantError}</p>
          </div>
        ) : null}

        {categoryFilter === "restaurant" && restaurantStatus === "ready" && search.trim().length < 2 ? (
          <div className="empty-panel">
            <p>Search at least 2 characters to browse restaurant items.</p>
          </div>
        ) : null}

        {shouldShowQuickPicksCard ? (
          <article className="food-library-card food-library-card--toggle">
            <button
              type="button"
              className="food-library-toggle"
              onClick={() => setIsQuickPicksOpen((current) => !current)}
              aria-expanded={isQuickPicksOpen}
            >
              <div>
                <h3>Quick Picks</h3>
                <p className="muted">Most recent and most picked foods</p>
              </div>
              <span className="food-library-toggle__chevron">
                {isQuickPicksOpen ? "−" : "+"}
              </span>
            </button>

            {isQuickPicksOpen ? (
              <div className="food-library-grid">
                {quickPickPreview.map((item) => (
                  <article className="food-library-card" key={item.id}>
                    <div className="log-card__top">
                      <div>
                        <h3>{item.name}</h3>
                        <p className="muted">
                          {item.brand ? `${item.brand} • ` : ""}
                          {item.servingSize}
                          {item.category ? ` • ${item.category}` : ""}
                        </p>
                      </div>
                      <strong>{item.calories} cal</strong>
                    </div>
                    <p className="muted">
                      P {item.protein}g • C {item.carbs}g • F {item.fat}g
                    </p>
                    <div className="button-row">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => loadPreset(item)}
                      >
                        Use preset
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => quickAddItem(item)}
                      >
                        Quick add
                      </button>
                      {item.itemType === "meal" || item.itemType === "saved-food" ? (
                        <button
                          type="button"
                          className="secondary-button danger-button"
                          onClick={() => onDeleteMeal(item.id)}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </article>
        ) : (
          <div className="food-library-grid">
            {filteredLibrary.map((item) => (
              <article className="food-library-card" key={item.id}>
                <div className="log-card__top">
                  <div>
                    <h3>{item.name}</h3>
                    <p className="muted">
                      {item.brand ? `${item.brand} • ` : ""}
                      {item.servingSize}
                      {item.category ? ` • ${item.category}` : ""}
                    </p>
                  </div>
                  <strong>{item.calories} cal</strong>
                </div>
                <p className="muted">
                  P {item.protein}g • C {item.carbs}g • F {item.fat}g
                </p>
                <div className="button-row">
                  <button type="button" className="secondary-button" onClick={() => loadPreset(item)}>
                    Use preset
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => quickAddItem(item)}
                  >
                    Quick add
                  </button>
                  {item.itemType === "meal" || item.itemType === "saved-food" ? (
                    <button
                      type="button"
                      className="secondary-button danger-button"
                      onClick={() => onDeleteMeal(item.id)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}

        {!filteredLibrary.length &&
        categoryFilter !== "restaurant" &&
        !(categoryFilter === "restaurant" && (restaurantStatus !== "ready" || search.trim().length < 2)) ? (
          <div className="empty-panel">
            <p>No library items match that search.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
