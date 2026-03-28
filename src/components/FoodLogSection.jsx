import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { FOOD_LIBRARY } from "../lib/foodLibrary";
import { loadFoodLibraryUsage, recordFoodLibraryUsage } from "../lib/libraryUsage";
import { searchRestaurantLibrary } from "../lib/restaurantLibrary";
import { computeSearchScore, getSearchMeta, isFuzzyMatch } from "../lib/search";

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

export function FoodLogSection({
  selectedDate,
  entries,
  allEntries,
  mealTemplates,
  onAddEntry,
  onAddEntries,
  onUpdateEntry,
  onDeleteEntry,
  onSaveMeal,
  onDeleteMeal,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [search, setSearch] = useState("");
  const [quickSearch, setQuickSearch] = useState("");
  const [quickSearchResults, setQuickSearchResults] = useState([]);
  const [quickSearchStatus, setQuickSearchStatus] = useState("idle");
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [usageCounts, setUsageCounts] = useState(() => loadFoodLibraryUsage());
  const [restaurantLibrary, setRestaurantLibrary] = useState([]);
  const [restaurantStatus, setRestaurantStatus] = useState("idle");
  const [restaurantError, setRestaurantError] = useState("");
  const deferredSearch = useDeferredValue(search);
  const deferredQuickSearch = useDeferredValue(quickSearch);
  const quickSearchRef = useRef(null);

  const totalCalories = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.calories, 0),
    [entries]
  );

  const previousDayEntries = useMemo(() => {
    const previousDate = new Date(`${selectedDate}T12:00:00`);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousDateString = previousDate.toISOString().slice(0, 10);

    return allEntries.filter((entry) => entry.date === previousDateString);
  }, [allEntries, selectedDate]);

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

    return [...savedMeals, ...FOOD_LIBRARY.map((item) => ({ ...item, itemType: "food" }))];
  }, [mealTemplates]);

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
    if (!isQuickSearchOpen || trimmedSearch.length < 2) {
      setQuickSearchResults([]);
      if (trimmedSearch.length < 2) {
        setQuickSearchStatus("idle");
      }
      return;
    }

    let isMounted = true;

    const localMatches = quickPickLibrary
      .map((item) => ({ item, meta: getItemSearchMeta(item, trimmedSearch) }))
      .filter(({ meta }) => meta.tier >= 2 || (meta.tier === 1 && meta.score >= 0.84))
      .sort((left, right) => {
        if (right.meta.tier !== left.meta.tier) {
          return right.meta.tier - left.meta.tier;
        }

        if (right.meta.score !== left.meta.score) {
          return right.meta.score - left.meta.score;
        }

        return left.item.name.localeCompare(right.item.name);
      })
      .map(({ item }) => item)
      .slice(0, 6);

    setQuickSearchResults(localMatches);
    setQuickSearchStatus("loading");

    const timeoutId = window.setTimeout(() => {
      searchRestaurantLibrary(trimmedSearch)
        .then((restaurantMatches) => {
          if (!isMounted) {
            return;
          }

          const seen = new Set(localMatches.map((item) => item.id));
          const mergedResults = [...localMatches];
          for (const item of restaurantMatches) {
            if (seen.has(item.id)) {
              continue;
            }
            mergedResults.push(item);
            seen.add(item.id);
            if (mergedResults.length >= 8) {
              break;
            }
          }

          mergedResults.sort((left, right) => {
            const leftMeta = getItemSearchMeta(left, trimmedSearch);
            const rightMeta = getItemSearchMeta(right, trimmedSearch);

            if (rightMeta.tier !== leftMeta.tier) {
              return rightMeta.tier - leftMeta.tier;
            }

            if (rightMeta.score !== leftMeta.score) {
              return rightMeta.score - leftMeta.score;
            }

            return left.name.localeCompare(right.name);
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
  }, [deferredQuickSearch, isQuickSearchOpen, quickPickLibrary]);

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

        if (categoryFilter === "all") {
          const rightUsage = usageCounts[right.item.id] || 0;
          const leftUsage = usageCounts[left.item.id] || 0;

          if (rightUsage !== leftUsage) {
            return rightUsage - leftUsage;
          }
        }

        return left.item.name.localeCompare(right.item.name);
      })
      .map(({ item }) => item);
  }, [categoryFilter, quickPickLibrary, restaurantLibrary, search, usageCounts]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setSelectedPreset(null);
  }

  function loadPreset(item) {
    const scalablePreset = getScalablePreset(item);
    setUsageCounts(recordFoodLibraryUsage(item.id));
    setSelectedPreset(scalablePreset);
    setQuickSearch(item.name);
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
    setEditingId(null);
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
      return;
    }

    const payload = buildPayload();

    if (editingId) {
      onUpdateEntry(editingId, payload);
    } else {
      onAddEntry(payload);
    }

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
    setEditingId(entry.id);
    setSelectedPreset(null);
    setForm({
      foodName: entry.foodName,
      servingSize: entry.servingSize,
      servingAmount: "",
      servingUnit: "",
      servingNote: "",
      calories: String(entry.calories),
      protein: String(entry.protein),
      carbs: String(entry.carbs),
      fat: String(entry.fat),
    });
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
  }

  return (
    <div className="section-stack">
      <section className="card">
        <div className="section-heading food-log-heading">
          <div>
            <p className="eyebrow">Food logging</p>
            <h2>{editingId ? "Edit food entry" : "Add food entry"}</h2>
          </div>
          <div className="food-log-search" ref={quickSearchRef}>
            <p className="muted">Selected day: {selectedDate}</p>
            <label className="food-log-search__label">
              <span className="sr-only">Search foods</span>
              <input
                value={quickSearch}
                onChange={(event) => {
                  setQuickSearch(event.target.value);
                  setIsQuickSearchOpen(true);
                }}
                onFocus={() => setIsQuickSearchOpen(true)}
                placeholder="Search foods or restaurants..."
              />
            </label>
            {isQuickSearchOpen && quickSearch.trim().length >= 2 ? (
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

        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Food name
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

          <div className="compact-grid">
            <label>
              Calories
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
              disabled={!canSaveCurrentForm()}
            >
              Add Food
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => submitEntry({ saveTemplateType: "food" })}
              disabled={!canSaveCurrentForm()}
            >
              Add Food + Save
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => submitEntry({ saveTemplateType: null })}
              disabled={!canSaveCurrentForm()}
            >
              Add Meal
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => submitEntry({ saveTemplateType: "meal" })}
              disabled={!canSaveCurrentForm()}
            >
              Add Meal + Save
            </button>
            {editingId ? (
              <button type="button" className="secondary-button" onClick={resetForm}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Day history</p>
            <h2>{entries.length} entries</h2>
          </div>
          <p className="muted">{totalCalories} calories logged</p>
        </div>

        {entries.length ? (
          <div className="list-stack">
            {entries.map((entry) => (
              <article className="log-card" key={entry.id}>
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
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            <p>No food logged for this day.</p>
          </div>
        )}
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
