import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthGate";

function roundMacroGrams(calories, percent, caloriesPerGram) {
  return Math.round((Number(calories) * Number(percent || 0)) / 100 / caloriesPerGram);
}

function parseOptionalNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return "";
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : "";
}

export function SettingsSection({ settings, onSave, syncStatus, syncError }) {
  const [form, setForm] = useState(settings);
  const { session, signOut, hasCloud } = useAuth();

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const macroPercents = useMemo(() => {
    const proteinPercent = Math.max(0, Math.min(80, Number(form.proteinPercent) || 0));
    const fatPercent = Math.max(0, Math.min(80, Number(form.fatPercent) || 0));
    const carbsPercent = Math.max(0, 100 - proteinPercent - fatPercent);

    return {
      proteinPercent,
      fatPercent,
      carbsPercent,
      overflow: proteinPercent + fatPercent > 100,
    };
  }, [form.fatPercent, form.proteinPercent]);

  const calculatedTargets = useMemo(() => {
    const calories = Number(form.calorieTarget) || 0;

    return {
      proteinTarget: roundMacroGrams(calories, macroPercents.proteinPercent, 4),
      carbsTarget: roundMacroGrams(calories, macroPercents.carbsPercent, 4),
      fatTarget: roundMacroGrams(calories, macroPercents.fatPercent, 9),
    };
  }, [form.calorieTarget, macroPercents]);

  function handleSubmit(event) {
    event.preventDefault();

    const nextSettings =
      form.macroTargetMode === "percentages"
        ? {
            calorieTarget: parseOptionalNumber(form.calorieTarget),
            proteinTarget:
              form.calorieTarget === "" ? "" : parseOptionalNumber(calculatedTargets.proteinTarget),
            carbsTarget:
              form.calorieTarget === "" ? "" : parseOptionalNumber(calculatedTargets.carbsTarget),
            fatTarget:
              form.calorieTarget === "" ? "" : parseOptionalNumber(calculatedTargets.fatTarget),
            macroTargetMode: "percentages",
            proteinPercent: macroPercents.proteinPercent,
            carbsPercent: macroPercents.carbsPercent,
            fatPercent: macroPercents.fatPercent,
            weightGoal: parseOptionalNumber(form.weightGoal),
            weightUnit: form.weightUnit,
            accentColor: form.accentColor,
          }
        : {
            calorieTarget: parseOptionalNumber(form.calorieTarget),
            proteinTarget: parseOptionalNumber(form.proteinTarget),
            carbsTarget: parseOptionalNumber(form.carbsTarget),
            fatTarget: parseOptionalNumber(form.fatTarget),
            macroTargetMode: "grams",
            proteinPercent: macroPercents.proteinPercent,
            carbsPercent: macroPercents.carbsPercent,
            fatPercent: macroPercents.fatPercent,
            weightGoal: parseOptionalNumber(form.weightGoal),
            weightUnit: form.weightUnit,
            accentColor: form.accentColor,
          };

    onSave(nextSettings);
  }

  return (
    <div className="section-stack">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Goals and settings</p>
            <h2>Targets</h2>
          </div>
          <p className="muted">These targets drive the dashboard calculations.</p>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Daily calorie target
            <input
              type="number"
              min="0"
              value={form.calorieTarget}
              onChange={(event) => setForm({ ...form, calorieTarget: event.target.value })}
              placeholder="2200"
            />
          </label>

          <div className="button-row">
            <button
              type="button"
              className={
                form.macroTargetMode === "grams"
                  ? "secondary-button is-selected-accent"
                  : "secondary-button"
              }
              onClick={() => setForm((current) => ({ ...current, macroTargetMode: "grams" }))}
            >
              Manual grams
            </button>
            <button
              type="button"
              className={
                form.macroTargetMode === "percentages"
                  ? "secondary-button is-selected-accent"
                  : "secondary-button"
              }
              onClick={() =>
                setForm((current) => ({ ...current, macroTargetMode: "percentages" }))
              }
            >
              Percentages
            </button>
          </div>

          {form.macroTargetMode === "percentages" ? (
            <>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Macro split</p>
                  <h2>Protein and fat drive the ratio</h2>
                </div>
                <p className="muted">Carbs auto-balance the remainder to keep the total at 100%.</p>
              </div>

              <div className="slider-group">
                <label>
                  Protein: {macroPercents.proteinPercent}%
                  <input
                    type="range"
                    min="10"
                    max={Math.max(10, 100 - macroPercents.fatPercent)}
                    value={macroPercents.proteinPercent}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, proteinPercent: event.target.value }))
                    }
                  />
                </label>

                <label>
                  Fat: {macroPercents.fatPercent}%
                  <input
                    type="range"
                    min="10"
                    max={Math.max(10, 100 - macroPercents.proteinPercent)}
                    value={macroPercents.fatPercent}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, fatPercent: event.target.value }))
                    }
                  />
                </label>
              </div>

              <div className="summary-grid">
                <div className="summary-panel">
                  <span>Protein</span>
                  <strong>{calculatedTargets.proteinTarget} g</strong>
                  <p className="muted">{macroPercents.proteinPercent}% of calories</p>
                </div>
                <div className="summary-panel">
                  <span>Carbs</span>
                  <strong>{calculatedTargets.carbsTarget} g</strong>
                  <p className="muted">{macroPercents.carbsPercent}% of calories</p>
                </div>
                <div className="summary-panel">
                  <span>Fat</span>
                  <strong>{calculatedTargets.fatTarget} g</strong>
                  <p className="muted">{macroPercents.fatPercent}% of calories</p>
                </div>
                <div className="summary-panel">
                  <span>Total split</span>
                  <strong>
                    {macroPercents.proteinPercent + macroPercents.carbsPercent + macroPercents.fatPercent}
                    %
                  </strong>
                  <p className="muted">
                    {macroPercents.overflow ? "Adjust protein or fat down." : "Carbs are auto-balanced."}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="compact-grid">
              <label>
                Protein target
                <input
                  type="number"
                  min="0"
                  value={form.proteinTarget}
                  onChange={(event) => setForm({ ...form, proteinTarget: event.target.value })}
                  placeholder="180"
                />
              </label>

              <label>
                Carbs target
                <input
                  type="number"
                  min="0"
                  value={form.carbsTarget}
                  onChange={(event) => setForm({ ...form, carbsTarget: event.target.value })}
                  placeholder="220"
                />
              </label>

              <label>
                Fat target
                <input
                  type="number"
                  min="0"
                  value={form.fatTarget}
                  onChange={(event) => setForm({ ...form, fatTarget: event.target.value })}
                  placeholder="70"
                />
              </label>
            </div>
          )}

          <div className="compact-grid compact-grid--two">
            <label>
              Weight goal
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.weightGoal}
                onChange={(event) => setForm({ ...form, weightGoal: event.target.value })}
              />
            </label>

            <label>
              Weight unit
              <select
                value={form.weightUnit}
                onChange={(event) => setForm({ ...form, weightUnit: event.target.value })}
              >
                <option value="lb">lb</option>
                <option value="kg">kg</option>
              </select>
            </label>
          </div>

          <button type="submit" className="primary-button">
            Save targets
          </button>
        </form>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Account</p>
            <h2>Cloud account</h2>
          </div>
          <p className="muted">
            {hasCloud ? "Manage your signed-in account and sync state." : "Cloud sync is not configured."}
          </p>
        </div>

        <div className="summary-grid">
          <div className="summary-panel">
            <span>Email</span>
            <p className="account-email">{session?.user?.email || "--"}</p>
          </div>
          <div className="summary-panel">
            <span>Sync status</span>
            <strong>{syncStatus ? `${syncStatus.charAt(0).toUpperCase()}${syncStatus.slice(1)}` : "--"}</strong>
            {syncError ? <p className="muted">{syncError}</p> : null}
          </div>
        </div>

        {session ? (
          <div className="account-actions">
            <button type="button" className="secondary-button" onClick={signOut}>
              Sign Out
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
