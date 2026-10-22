import {
  loadCloudCache,
  saveCloudCache,
  updateCloudCache,
} from "./storage.local";
import { supabase } from "./supabase";

let lastSyncedState = null;

const SYNCED_COLLECTIONS = [
  "settings",
  "foodEntries",
  "mealTemplates",
  "weightEntries",
  "waterEntries",
  "workoutEntries",
  "customWorkoutSystems",
];

function normalizeSyncState(state = {}) {
  return {
    settings: {},
    foodEntries: [],
    mealTemplates: [],
    weightEntries: [],
    waterEntries: [],
    workoutEntries: [],
    customWorkoutSystems: [],
    ...state,
  };
}

function cloneState(value) {
  return JSON.parse(JSON.stringify(value));
}

async function getCurrentSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session;
}

async function getCurrentUserId() {
  const session = await getCurrentSession();
  return session?.user?.id || null;
}

function isMissingWaterEntriesError(error) {
  const message = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  const code = String(error?.code || "").toUpperCase();

  return (
    message.includes("water_entries") ||
    details.includes("water_entries") ||
    code === "42P01" ||
    code === "PGRST205"
  );
}

function mapNullableNumber(value) {
  return value ?? "";
}

function toNullableNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function mapSettingsRow(row) {
  if (!row) {
    return null;
  }

  return {
    calorieTarget: mapNullableNumber(row.calorie_target),
    proteinTarget: mapNullableNumber(row.protein_target),
    carbsTarget: mapNullableNumber(row.carbs_target),
    fatTarget: mapNullableNumber(row.fat_target),
    macroTargetMode: row.macro_target_mode || "grams",
    proteinPercent: row.protein_percent ?? 35,
    carbsPercent: row.carbs_percent ?? 40,
    fatPercent: row.fat_percent ?? 25,
    weightGoal: mapNullableNumber(row.weight_goal),
    weightUnit: row.weight_unit || "lb",
    accentColor: row.accent_color || "blue",
    lastSelectedWorkoutProgramId: row.last_selected_workout_program_id || "",
  };
}

function mapSettingsToRow(userId, settings) {
  return {
    user_id: userId,
    calorie_target: toNullableNumber(settings.calorieTarget),
    protein_target: toNullableNumber(settings.proteinTarget),
    carbs_target: toNullableNumber(settings.carbsTarget),
    fat_target: toNullableNumber(settings.fatTarget),
    macro_target_mode: settings.macroTargetMode || "grams",
    protein_percent: settings.proteinPercent ?? 35,
    carbs_percent: settings.carbsPercent ?? 40,
    fat_percent: settings.fatPercent ?? 25,
    weight_goal: toNullableNumber(settings.weightGoal),
    weight_unit: settings.weightUnit || "lb",
    accent_color: settings.accentColor || "blue",
    last_selected_workout_program_id: settings.lastSelectedWorkoutProgramId || null,
  };
}

function mapFoodEntryFromRow(row) {
  return {
    id: row.id,
    date: row.date,
    foodName: row.food_name,
    servingSize: row.serving_size,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
  };
}

function mapFoodEntryToRow(userId, entry) {
  return {
    id: entry.id,
    user_id: userId,
    date: entry.date,
    food_name: entry.foodName,
    serving_size: entry.servingSize,
    calories: entry.calories,
    protein: entry.protein,
    carbs: entry.carbs,
    fat: entry.fat,
  };
}

function mapMealTemplateFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    templateType: row.template_type || "meal",
    creator: row.creator || "",
    servingSize: row.serving_size,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
  };
}

function mapMealTemplateToRow(userId, meal) {
  return {
    id: meal.id,
    user_id: userId,
    name: meal.name,
    template_type: meal.templateType || "meal",
    creator: meal.creator || null,
    serving_size: meal.servingSize,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
  };
}

function mapWeightEntryFromRow(row) {
  return {
    id: row.id,
    date: row.date,
    weight: row.weight,
    notes: row.notes || "",
  };
}

function mapWeightEntryToRow(userId, entry) {
  return {
    id: entry.id,
    user_id: userId,
    date: entry.date,
    weight: entry.weight,
    notes: entry.notes || "",
  };
}

function mapWaterEntryFromRow(row) {
  return {
    id: row.id,
    date: row.date,
    ounces: row.ounces,
  };
}

function mapWaterEntryToRow(userId, entry) {
  return {
    id: entry.id,
    user_id: userId,
    date: entry.date,
    ounces: entry.ounces,
  };
}

function mapWorkoutEntryFromRow(row) {
  return {
    id: row.id,
    date: row.date,
    systemId: row.system_id,
    systemName: row.system_name,
    workoutId: row.workout_id,
    workoutName: row.workout_name,
    exercises: row.exercises,
  };
}

function mapWorkoutEntryToRow(userId, entry) {
  return {
    id: entry.id,
    user_id: userId,
    date: entry.date,
    system_id: entry.systemId,
    system_name: entry.systemName,
    workout_id: entry.workoutId,
    workout_name: entry.workoutName,
    exercises: entry.exercises,
  };
}

function mapWorkoutSystemFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    isCustom: row.is_custom,
    workouts: row.workouts,
  };
}

function mapWorkoutSystemToRow(userId, system) {
  return {
    id: system.id,
    user_id: userId,
    name: system.name,
    description: system.description || "",
    is_custom: Boolean(system.isCustom),
    workouts: system.workouts,
  };
}

async function upsertRows(table, rows) {
  const { error } = await supabase.from(table).upsert(rows);
  if (error) {
    throw error;
  }
}

async function syncCollection(table, userId, previousRows, nextRows, mapper) {
  const previousMap = new Map(previousRows.map((row) => [row.id, row]));
  const nextMap = new Map(nextRows.map((row) => [row.id, row]));

  const changedRows = nextRows.filter((row) => {
    const previous = previousMap.get(row.id);
    return !previous || JSON.stringify(previous) !== JSON.stringify(row);
  });

  const deletedIds = previousRows
    .filter((row) => !nextMap.has(row.id))
    .map((row) => row.id);

  if (changedRows.length) {
    await upsertRows(
      table,
      changedRows.map((row) => mapper(userId, row))
    );
  }

  if (deletedIds.length) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("user_id", userId)
      .in("id", deletedIds);
    if (error) {
      throw error;
    }
  }
}

async function beginCollectionSync(collection, value) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return null;
  }

  updateCloudCache(userId, { [collection]: value }, { markPending: collection });
  return userId;
}

function finishCollectionSync(userId, collection, value) {
  updateCloudCache(userId, { [collection]: value }, { clearPending: collection });
  lastSyncedState = {
    ...(lastSyncedState || {}),
    [collection]: cloneState(value),
  };
}

export const supabaseStorageAdapter = {
  async load() {
    const session = await getCurrentSession();

    if (!session?.user) {
      return {};
    }

    const [
      settingsResult,
      foodResult,
      mealResult,
      weightResult,
      waterResultRaw,
      workoutResult,
      customSystemResult,
    ] = await Promise.all([
      supabase.from("settings").select("*").eq("user_id", session.user.id).maybeSingle(),
      supabase
        .from("food_entries")
        .select("*")
        .eq("user_id", session.user.id)
        .order("date", { ascending: false }),
      supabase
        .from("meal_templates")
        .select("*")
        .eq("user_id", session.user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("weight_entries")
        .select("*")
        .eq("user_id", session.user.id)
        .order("date", { ascending: false }),
      supabase
        .from("water_entries")
        .select("*")
        .eq("user_id", session.user.id)
        .order("date", { ascending: false }),
      supabase
        .from("workout_entries")
        .select("*")
        .eq("user_id", session.user.id)
        .order("date", { ascending: false }),
      supabase
        .from("custom_workout_systems")
        .select("*")
        .eq("user_id", session.user.id)
        .order("updated_at", { ascending: false }),
    ]);

    const waterTableUnavailable =
      waterResultRaw.error && isMissingWaterEntriesError(waterResultRaw.error);
    const waterResult =
      waterTableUnavailable
        ? { data: [], error: null }
        : waterResultRaw;

    for (const result of [
      settingsResult,
      foodResult,
      mealResult,
      weightResult,
      waterResult,
      workoutResult,
      customSystemResult,
    ]) {
      if (result.error) {
        throw result.error;
      }
    }

    const remoteSnapshot = {
      settings: mapSettingsRow(settingsResult.data) || undefined,
      foodEntries: foodResult.data.map(mapFoodEntryFromRow),
      mealTemplates: mealResult.data.map(mapMealTemplateFromRow),
      weightEntries: weightResult.data.map(mapWeightEntryFromRow),
      waterEntries: waterResult.data.map(mapWaterEntryFromRow),
      workoutEntries: workoutResult.data.map(mapWorkoutEntryFromRow),
      customWorkoutSystems: customSystemResult.data.map(mapWorkoutSystemFromRow),
    };
    const cached = loadCloudCache(session.user.id);
    const pendingCollections = new Set(cached?.pendingCollections || []);
    const snapshot = { ...remoteSnapshot };

    for (const collection of pendingCollections) {
      if (cached?.snapshot?.[collection] !== undefined) {
        snapshot[collection] = cached.snapshot[collection];
      }
    }

    if (waterTableUnavailable && cached?.snapshot?.waterEntries !== undefined) {
      snapshot.waterEntries = cached.snapshot.waterEntries;
    }

    saveCloudCache(session.user.id, snapshot, [...pendingCollections]);
    lastSyncedState = cloneState(remoteSnapshot);
    return snapshot;
  },

  async loadOfflineCache() {
    const userId = await getCurrentUserId();
    return userId ? loadCloudCache(userId) : null;
  },

  async syncPendingChanges() {
    const userId = await getCurrentUserId();
    const cached = userId ? loadCloudCache(userId) : null;

    if (!cached?.pendingCollections.length) {
      return false;
    }

    await this.save(cached.snapshot);
    return true;
  },

  async save(state) {
    const normalizedState = normalizeSyncState(state);
    const session = await getCurrentSession();

    if (!session?.user) {
      return;
    }

    const userId = session.user.id;
    saveCloudCache(userId, normalizedState, SYNCED_COLLECTIONS);
    const previousState = lastSyncedState || {
      settings: null,
      foodEntries: [],
      mealTemplates: [],
      weightEntries: [],
      waterEntries: [],
      workoutEntries: [],
      customWorkoutSystems: [],
    };

    if (JSON.stringify(previousState.settings) !== JSON.stringify(normalizedState.settings)) {
      const { error: settingsError } = await supabase
        .from("settings")
        .upsert(mapSettingsToRow(userId, normalizedState.settings), { onConflict: "user_id" });

      if (settingsError) {
        throw settingsError;
      }
    }

    await Promise.all([
      syncCollection(
        "food_entries",
        userId,
        previousState.foodEntries || [],
        normalizedState.foodEntries,
        mapFoodEntryToRow
      ),
      syncCollection(
        "meal_templates",
        userId,
        previousState.mealTemplates || [],
        normalizedState.mealTemplates,
        mapMealTemplateToRow
      ),
      syncCollection(
        "weight_entries",
        userId,
        previousState.weightEntries || [],
        normalizedState.weightEntries,
        mapWeightEntryToRow
      ),
      syncCollection(
        "water_entries",
        userId,
        previousState.waterEntries || [],
        normalizedState.waterEntries,
        mapWaterEntryToRow
      ),
      syncCollection(
        "workout_entries",
        userId,
        previousState.workoutEntries || [],
        normalizedState.workoutEntries,
        mapWorkoutEntryToRow
      ),
      syncCollection(
        "custom_workout_systems",
        userId,
        previousState.customWorkoutSystems || [],
        normalizedState.customWorkoutSystems,
        mapWorkoutSystemToRow
      ),
    ]);

    lastSyncedState = cloneState(normalizedState);
    saveCloudCache(userId, normalizedState, []);
  },

  async syncSettings(settings) {
    const userId = await beginCollectionSync("settings", settings);
    if (!userId) {
      return;
    }

    const { error: upsertError } = await supabase
      .from("settings")
      .upsert(mapSettingsToRow(userId, settings), { onConflict: "user_id" });

    if (upsertError) {
      throw upsertError;
    }

    finishCollectionSync(userId, "settings", settings);
  },

  async syncFoodEntries(foodEntries) {
    const userId = await beginCollectionSync("foodEntries", foodEntries);
    if (!userId) {
      return;
    }

    await syncCollection(
      "food_entries",
      userId,
      lastSyncedState?.foodEntries || [],
      foodEntries,
      mapFoodEntryToRow
    );
    finishCollectionSync(userId, "foodEntries", foodEntries);
  },

  async syncMealTemplates(mealTemplates) {
    const userId = await beginCollectionSync("mealTemplates", mealTemplates);
    if (!userId) {
      return;
    }

    await syncCollection(
      "meal_templates",
      userId,
      lastSyncedState?.mealTemplates || [],
      mealTemplates,
      mapMealTemplateToRow
    );
    finishCollectionSync(userId, "mealTemplates", mealTemplates);
  },

  async syncWeightEntries(weightEntries) {
    const userId = await beginCollectionSync("weightEntries", weightEntries);
    if (!userId) {
      return;
    }

    await syncCollection(
      "weight_entries",
      userId,
      lastSyncedState?.weightEntries || [],
      weightEntries,
      mapWeightEntryToRow
    );
    finishCollectionSync(userId, "weightEntries", weightEntries);
  },

  async syncWaterEntries(waterEntries) {
    const userId = await beginCollectionSync("waterEntries", waterEntries);
    if (!userId) {
      return;
    }

    try {
      await syncCollection(
        "water_entries",
        userId,
        lastSyncedState?.waterEntries || [],
        waterEntries,
        mapWaterEntryToRow
      );
    } catch (error) {
      if (isMissingWaterEntriesError(error)) {
        console.warn("Skipping water entry sync because the water_entries table is unavailable.", error);
        return;
      }
      throw error;
    }
    finishCollectionSync(userId, "waterEntries", waterEntries);
  },

  async syncWorkoutEntries(workoutEntries) {
    const userId = await beginCollectionSync("workoutEntries", workoutEntries);
    if (!userId) {
      return;
    }

    await syncCollection(
      "workout_entries",
      userId,
      lastSyncedState?.workoutEntries || [],
      workoutEntries,
      mapWorkoutEntryToRow
    );
    finishCollectionSync(userId, "workoutEntries", workoutEntries);
  },

  async syncCustomWorkoutSystems(customWorkoutSystems) {
    const userId = await beginCollectionSync("customWorkoutSystems", customWorkoutSystems);
    if (!userId) {
      return;
    }

    await syncCollection(
      "custom_workout_systems",
      userId,
      lastSyncedState?.customWorkoutSystems || [],
      customWorkoutSystems,
      mapWorkoutSystemToRow
    );
    finishCollectionSync(userId, "customWorkoutSystems", customWorkoutSystems);
  },
};
