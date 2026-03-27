import { useMemo, useState } from "react";
import { FOOD_LIBRARY } from "../lib/foodLibrary";

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
  const [categoryFilter, setCategoryFilter] = useState("all");

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

  const filteredLibrary = useMemo(() => {
    const savedMeals = mealTemplates.map((meal) => ({
      ...meal,
      category: meal.templateType === "food" ? "food" : "meal",
      itemType: meal.templateType === "food" ? "saved-food" : "meal",
      isScalable: false,
    }));

    return [...savedMeals, ...FOOD_LIBRARY.map((item) => ({ ...item, itemType: "food" }))].filter(
      (item) => {
        const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
        const matchesSearch =
          !search ||
          item.name.toLowerCase().includes(search.toLowerCase()) ||
          item.servingSize.toLowerCase().includes(search.toLowerCase());

        return matchesCategory && matchesSearch;
      }
    );
  }, [categoryFilter, mealTemplates, search]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setSelectedPreset(null);
  }

  function loadPreset(item) {
    setSelectedPreset(item.isScalable ? item : null);
    setForm({
      foodName: item.name,
      servingSize: item.servingSize,
      servingAmount: item.baseAmount ? String(item.baseAmount) : "",
      servingUnit: item.baseUnit || "",
      servingNote: item.servingNote || "",
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

  return (
    <div className="section-stack">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Food logging</p>
            <h2>{editingId ? "Edit food entry" : "Add food entry"}</h2>
          </div>
          <p className="muted">Selected day: {selectedDate}</p>
        </div>

        <div className="button-row">
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
              placeholder="Chicken, potato, yogurt..."
            />
          </label>

          <div className="button-row">
            {["all", "protein", "carb", "fat", "meal"].map((category) => (
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
                {category === "all" ? "All" : category === "meal" ? "Meals" : category}
              </button>
            ))}
          </div>
        </div>

        <div className="food-library-grid">
          {filteredLibrary.map((item) => (
            <article className="food-library-card" key={item.id}>
              <div className="log-card__top">
                <div>
                  <h3>{item.name}</h3>
                  <p className="muted">
                    {item.servingSize} • {item.category}
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
                  onClick={() =>
                    onAddEntry({
                      date: selectedDate,
                      foodName: item.name,
                      servingSize: item.servingSize,
                      calories: item.calories,
                      protein: item.protein,
                      carbs: item.carbs,
                      fat: item.fat,
                    })
                  }
                >
                  Quick add
                </button>
                {item.itemType === "meal" ? (
                  <button
                    type="button"
                    className="secondary-button danger-button"
                    onClick={() => onDeleteMeal(item.id)}
                  >
                    Delete meal
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
