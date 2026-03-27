import { supabase } from "./supabase";

let lastSyncedState = null;

function cloneState(value) {
  return JSON.parse(JSON.stringify(value));
}

function mapSettingsRow(row) {
  if (!row) {
    return null;
  }

  return {
    calorieTarget: row.calorie_target,
    proteinTarget: row.protein_target,
    carbsTarget: row.carbs_target,
    fatTarget: row.fat_target,
    macroTargetMode: row.macro_target_mode || "grams",
    proteinPercent: row.protein_percent ?? 35,
    carbsPercent: row.carbs_percent ?? 40,
    fatPercent: row.fat_percent ?? 25,
    weightGoal: row.weight_goal ?? "",
    weightUnit: row.weight_unit,
    accentColor: row.accent_color,
  };
}

function mapSettingsToRow(userId, settings) {
  return {
    user_id: userId,
    calorie_target: settings.calorieTarget,
    protein_target: settings.proteinTarget,
    carbs_target: settings.carbsTarget,
    fat_target: settings.fatTarget,
    macro_target_mode: settings.macroTargetMode || "grams",
    protein_percent: settings.proteinPercent ?? 35,
    carbs_percent: settings.carbsPercent ?? 40,
    fat_percent: settings.fatPercent ?? 25,
    weight_goal: settings.weightGoal || null,
    weight_unit: settings.weightUnit,
    accent_color: settings.accentColor,
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
    const { error } = await supabase.from(table).delete().in("id", deletedIds);
    if (error) {
      throw error;
    }
  }
}

export const supabaseStorageAdapter = {
  async load() {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    if (!session?.user) {
      return {};
    }

    const [settingsResult, foodResult, mealResult, weightResult, workoutResult, customSystemResult] =
      await Promise.all([
        supabase.from("settings").select("*").maybeSingle(),
        supabase.from("food_entries").select("*").order("date", { ascending: false }),
        supabase.from("meal_templates").select("*").order("updated_at", { ascending: false }),
        supabase.from("weight_entries").select("*").order("date", { ascending: false }),
        supabase.from("workout_entries").select("*").order("date", { ascending: false }),
        supabase.from("custom_workout_systems").select("*").order("updated_at", { ascending: false }),
      ]);

    for (const result of [
      settingsResult,
      foodResult,
      mealResult,
      weightResult,
      workoutResult,
      customSystemResult,
    ]) {
      if (result.error) {
        throw result.error;
      }
    }

    const snapshot = {
      settings: mapSettingsRow(settingsResult.data) || undefined,
      foodEntries: foodResult.data.map(mapFoodEntryFromRow),
      mealTemplates: mealResult.data.map(mapMealTemplateFromRow),
      weightEntries: weightResult.data.map(mapWeightEntryFromRow),
      workoutEntries: workoutResult.data.map(mapWorkoutEntryFromRow),
      customWorkoutSystems: customSystemResult.data.map(mapWorkoutSystemFromRow),
    };

    lastSyncedState = cloneState(snapshot);
    return snapshot;
  },

  async save(state) {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    if (!session?.user) {
      return;
    }

    const userId = session.user.id;
    const previousState = lastSyncedState || {
      settings: null,
      foodEntries: [],
      mealTemplates: [],
      weightEntries: [],
      workoutEntries: [],
      customWorkoutSystems: [],
    };

    if (JSON.stringify(previousState.settings) !== JSON.stringify(state.settings)) {
      const { error: settingsError } = await supabase
        .from("settings")
        .upsert(mapSettingsToRow(userId, state.settings), { onConflict: "user_id" });

      if (settingsError) {
        throw settingsError;
      }
    }

    await Promise.all([
      syncCollection(
        "food_entries",
        userId,
        previousState.foodEntries || [],
        state.foodEntries,
        mapFoodEntryToRow
      ),
      syncCollection(
        "meal_templates",
        userId,
        previousState.mealTemplates || [],
        state.mealTemplates,
        mapMealTemplateToRow
      ),
      syncCollection(
        "weight_entries",
        userId,
        previousState.weightEntries || [],
        state.weightEntries,
        mapWeightEntryToRow
      ),
      syncCollection(
        "workout_entries",
        userId,
        previousState.workoutEntries || [],
        state.workoutEntries,
        mapWorkoutEntryToRow
      ),
      syncCollection(
        "custom_workout_systems",
        userId,
        previousState.customWorkoutSystems || [],
        state.customWorkoutSystems,
        mapWorkoutSystemToRow
      ),
    ]);

    lastSyncedState = cloneState(state);
  },

  async syncSettings(settings) {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error || !session?.user) {
      if (error) {
        throw error;
      }
      return;
    }

    const { error: upsertError } = await supabase
      .from("settings")
      .upsert(mapSettingsToRow(session.user.id, settings), { onConflict: "user_id" });

    if (upsertError) {
      throw upsertError;
    }
  },

  async syncFoodEntries(foodEntries) {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error || !session?.user) {
      if (error) {
        throw error;
      }
      return;
    }

    await syncCollection(
      "food_entries",
      session.user.id,
      lastSyncedState?.foodEntries || [],
      foodEntries,
      mapFoodEntryToRow
    );
    lastSyncedState = {
      ...(lastSyncedState || {}),
      foodEntries: cloneState(foodEntries),
    };
  },

  async syncMealTemplates(mealTemplates) {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error || !session?.user) {
      if (error) {
        throw error;
      }
      return;
    }

    await syncCollection(
      "meal_templates",
      session.user.id,
      lastSyncedState?.mealTemplates || [],
      mealTemplates,
      mapMealTemplateToRow
    );
    lastSyncedState = {
      ...(lastSyncedState || {}),
      mealTemplates: cloneState(mealTemplates),
    };
  },

  async syncWeightEntries(weightEntries) {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error || !session?.user) {
      if (error) {
        throw error;
      }
      return;
    }

    await syncCollection(
      "weight_entries",
      session.user.id,
      lastSyncedState?.weightEntries || [],
      weightEntries,
      mapWeightEntryToRow
    );
    lastSyncedState = {
      ...(lastSyncedState || {}),
      weightEntries: cloneState(weightEntries),
    };
  },

  async syncWorkoutEntries(workoutEntries) {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error || !session?.user) {
      if (error) {
        throw error;
      }
      return;
    }

    await syncCollection(
      "workout_entries",
      session.user.id,
      lastSyncedState?.workoutEntries || [],
      workoutEntries,
      mapWorkoutEntryToRow
    );
    lastSyncedState = {
      ...(lastSyncedState || {}),
      workoutEntries: cloneState(workoutEntries),
    };
  },

  async syncCustomWorkoutSystems(customWorkoutSystems) {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error || !session?.user) {
      if (error) {
        throw error;
      }
      return;
    }

    await syncCollection(
      "custom_workout_systems",
      session.user.id,
      lastSyncedState?.customWorkoutSystems || [],
      customWorkoutSystems,
      mapWorkoutSystemToRow
    );
    lastSyncedState = {
      ...(lastSyncedState || {}),
      customWorkoutSystems: cloneState(customWorkoutSystems),
    };
  },
};
