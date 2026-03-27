import { useEffect, useState } from "react";
import { useAuth } from "./AuthGate";

export function SettingsSection({ settings, onSave, syncStatus, syncError }) {
  const [form, setForm] = useState(settings);
  const { session, signOut, hasCloud } = useAuth();

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  function handleSubmit(event) {
    event.preventDefault();

    onSave({
      calorieTarget: Number(form.calorieTarget),
      proteinTarget: Number(form.proteinTarget),
      carbsTarget: Number(form.carbsTarget),
      fatTarget: Number(form.fatTarget),
      weightGoal: form.weightGoal ? Number(form.weightGoal) : "",
      weightUnit: form.weightUnit,
    });
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
              required
            />
          </label>

          <div className="compact-grid">
            <label>
              Protein target
              <input
                type="number"
                min="0"
                value={form.proteinTarget}
                onChange={(event) => setForm({ ...form, proteinTarget: event.target.value })}
                required
              />
            </label>

            <label>
              Carbs target
              <input
                type="number"
                min="0"
                value={form.carbsTarget}
                onChange={(event) => setForm({ ...form, carbsTarget: event.target.value })}
                required
              />
            </label>

            <label>
              Fat target
              <input
                type="number"
                min="0"
                value={form.fatTarget}
                onChange={(event) => setForm({ ...form, fatTarget: event.target.value })}
                required
              />
            </label>
          </div>

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
            <strong>{session?.user?.email || "--"}</strong>
          </div>
          <div className="summary-panel">
            <span>Sync status</span>
            <strong>{syncStatus}</strong>
            {syncError ? <p className="muted">{syncError}</p> : null}
          </div>
        </div>

        {session ? (
          <button type="button" className="secondary-button" onClick={signOut}>
            Sign out
          </button>
        ) : null}
      </section>
    </div>
  );
}
