import { useEffect, useReducer, useRef, useState } from "react";
import { appStorage, storageCapabilities } from "../lib/storage";
import { createId, getToday } from "../lib/date";
import { hasSupabaseConfig } from "../lib/supabase";
import { hasMeaningfulLocalData, localStorageAdapter } from "../lib/storage.local";

const initialState = {
  selectedDate: getToday(),
  settings: {
    calorieTarget: 2200,
    proteinTarget: 180,
    carbsTarget: 220,
    fatTarget: 70,
    weightGoal: "",
    weightUnit: "lb",
    accentColor: "blue",
  },
  foodEntries: [],
  mealTemplates: [],
  customWorkoutSystems: [],
  weightEntries: [],
  workoutEntries: [],
};

function normalizeWorkoutEntry(entry) {
  if (entry.exercises) {
    return entry;
  }

  return {
    id: entry.id || createId(),
    date: entry.date,
    systemId: "legacy",
    systemName: "Legacy Workout",
    workoutId: "legacy",
    workoutName: entry.exerciseName || "Workout",
    exercises: [
      {
        name: entry.exerciseName || "Exercise",
        target: `${entry.sets || 0} x ${entry.reps || 0}`,
        sets: [
          {
            reps: Number(entry.reps || 0),
            weight: Number(entry.weight || 0),
          },
        ],
      },
    ],
  };
}

function normalizeHydratedState(payload) {
  return {
    ...payload,
    settings: {
      ...initialState.settings,
      ...(payload.settings || {}),
    },
    workoutEntries: Array.isArray(payload.workoutEntries)
      ? payload.workoutEntries.map(normalizeWorkoutEntry)
      : [],
    mealTemplates: Array.isArray(payload.mealTemplates) ? payload.mealTemplates : [],
    customWorkoutSystems: Array.isArray(payload.customWorkoutSystems)
      ? payload.customWorkoutSystems
      : [],
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        ...normalizeHydratedState(action.payload),
        selectedDate: action.payload.selectedDate || state.selectedDate,
      };
    case "setSelectedDate":
      return { ...state, selectedDate: action.payload };
    case "updateSettings":
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case "addFoodEntry":
      return {
        ...state,
        foodEntries: [{ id: createId(), ...action.payload }, ...state.foodEntries],
      };
    case "addFoodEntries":
      return {
        ...state,
        foodEntries: [
          ...action.payload.map((entry) => ({ id: createId(), ...entry })),
          ...state.foodEntries,
        ],
      };
    case "updateFoodEntry":
      return {
        ...state,
        foodEntries: state.foodEntries.map((entry) =>
          entry.id === action.payload.id ? { ...entry, ...action.payload.updates } : entry
        ),
      };
    case "deleteFoodEntry":
      return {
        ...state,
        foodEntries: state.foodEntries.filter((entry) => entry.id !== action.payload),
      };
    case "addMealTemplate":
      if (
        state.mealTemplates.some(
          (meal) =>
            meal.name.toLowerCase() === action.payload.name.toLowerCase() &&
            (meal.templateType || "meal") === (action.payload.templateType || "meal") &&
            meal.servingSize.toLowerCase() === action.payload.servingSize.toLowerCase()
        )
      ) {
        return {
          ...state,
          mealTemplates: state.mealTemplates.map((meal) =>
            meal.name.toLowerCase() === action.payload.name.toLowerCase() &&
            (meal.templateType || "meal") === (action.payload.templateType || "meal") &&
            meal.servingSize.toLowerCase() === action.payload.servingSize.toLowerCase()
              ? { ...meal, ...action.payload }
              : meal
          ),
        };
      }

      return {
        ...state,
        mealTemplates: [{ id: createId(), ...action.payload }, ...state.mealTemplates],
      };
    case "deleteMealTemplate":
      return {
        ...state,
        mealTemplates: state.mealTemplates.filter((meal) => meal.id !== action.payload),
      };
    case "saveCustomWorkoutSystem": {
      const nextSystem = {
        ...action.payload,
        id: action.payload.id || createId(),
        workouts: action.payload.workouts.map((workout) => ({
          ...workout,
          id: workout.id || createId(),
        })),
      };

      const exists = state.customWorkoutSystems.some((system) => system.id === nextSystem.id);

      return {
        ...state,
        customWorkoutSystems: exists
          ? state.customWorkoutSystems.map((system) =>
              system.id === nextSystem.id ? nextSystem : system
            )
          : [nextSystem, ...state.customWorkoutSystems],
      };
    }
    case "deleteCustomWorkoutSystem":
      return {
        ...state,
        customWorkoutSystems: state.customWorkoutSystems.filter(
          (system) => system.id !== action.payload
        ),
      };
    case "upsertWeightEntry": {
      const existing = state.weightEntries.find((entry) => entry.date === action.payload.date);

      if (existing) {
        return {
          ...state,
          weightEntries: state.weightEntries.map((entry) =>
            entry.id === existing.id
              ? { ...entry, weight: action.payload.weight, notes: action.payload.notes || "" }
              : entry
          ),
        };
      }

      return {
        ...state,
        weightEntries: [{ id: createId(), ...action.payload }, ...state.weightEntries],
      };
    }
    case "deleteWeightEntry":
      return {
        ...state,
        weightEntries: state.weightEntries.filter((entry) => entry.id !== action.payload),
      };
    case "addWorkoutEntry":
      return {
        ...state,
        workoutEntries: [{ id: createId(), ...action.payload }, ...state.workoutEntries],
      };
    case "deleteWorkoutEntry":
      return {
        ...state,
        workoutEntries: state.workoutEntries.filter((entry) => entry.id !== action.payload),
      };
    default:
      return state;
  }
}

export function useFitTrackStore() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [isHydrated, setIsHydrated] = useReducer(() => true, false);
  const [syncStatus, setSyncStatus] = useState(hasSupabaseConfig ? "loading" : "local");
  const [syncError, setSyncError] = useState("");
  const [localMigrationData, setLocalMigrationData] = useState(null);
  const lastCloudRefreshAtRef = useRef(0);

  useEffect(() => {
    let isMounted = true;

    async function hydrateStore() {
      try {
        const [payload, localSnapshot] = await Promise.all([
          appStorage.load(),
          hasSupabaseConfig ? localStorageAdapter.load() : Promise.resolve({}),
        ]);

        if (!isMounted) {
          return;
        }

        dispatch({ type: "hydrate", payload });
        if (
          hasSupabaseConfig &&
          hasMeaningfulLocalData(localSnapshot) &&
          !hasMeaningfulLocalData(payload)
        ) {
          setLocalMigrationData(localSnapshot);
        }
        setSyncStatus(hasSupabaseConfig ? "synced" : "local");
        setSyncError("");
        lastCloudRefreshAtRef.current = Date.now();
        setIsHydrated();
      } catch (error) {
        console.error("Failed to hydrate FitTrack state.", error);
        if (isMounted) {
          setSyncStatus("error");
          setSyncError(error.message || "Failed to load data.");
          setIsHydrated();
        }
      }
    }

    hydrateStore();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated || !storageCapabilities.hasCloudConfig) {
      return;
    }

    let isRefreshing = false;

    async function refreshFromCloud() {
      const now = Date.now();
      if (isRefreshing || now - lastCloudRefreshAtRef.current < 4000) {
        return;
      }

      isRefreshing = true;

      try {
        const payload = await appStorage.load();
        dispatch({ type: "hydrate", payload });
        setSyncStatus("synced");
        setSyncError("");
        lastCloudRefreshAtRef.current = Date.now();
      } catch (error) {
        console.error("Failed to refresh FitTrack cloud state.", error);
        setSyncStatus("error");
        setSyncError(error.message || "Failed to refresh cloud data.");
      } finally {
        isRefreshing = false;
      }
    }

    function handleFocus() {
      refreshFromCloud();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshFromCloud();
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (storageCapabilities.supportsGranularSync) {
      setSyncStatus("synced");
      return;
    }

    setSyncStatus(hasSupabaseConfig ? "saving" : "local");
    appStorage
      .save(state)
      .then(() => {
        setSyncStatus(hasSupabaseConfig ? "synced" : "local");
        setSyncError("");
      })
      .catch((error) => {
        console.error("Failed to persist FitTrack state.", error);
        setSyncStatus("error");
        setSyncError(error.message || "Failed to sync data.");
      });
  }, [isHydrated, state]);

  return {
    state,
    syncStatus,
    syncError,
    localMigrationData,
    dismissLocalMigration: () => setLocalMigrationData(null),
    importLocalMigration: () => {
      if (!localMigrationData) {
        return;
      }
      dispatch({ type: "hydrate", payload: localMigrationData });
      setLocalMigrationData(null);
    },
    addFoodEntry: (entry) => {
      const nextEntries = [{ id: createId(), ...entry }, ...state.foodEntries];
      dispatch({ type: "hydrate", payload: { foodEntries: nextEntries } });
      if (storageCapabilities.supportsGranularSync) {
        setSyncStatus("saving");
        appStorage
          .syncFoodEntries(nextEntries)
          .then(() => {
            setSyncStatus("synced");
            setSyncError("");
          })
          .catch((error) => {
            setSyncStatus("error");
            setSyncError(error.message || "Failed to sync food entries.");
          });
      }
    },
    addFoodEntries: (entries) => {
      const nextEntries = [
        ...entries.map((entry) => ({ id: createId(), ...entry })),
        ...state.foodEntries,
      ];
      dispatch({ type: "hydrate", payload: { foodEntries: nextEntries } });
      if (storageCapabilities.supportsGranularSync) {
        setSyncStatus("saving");
        appStorage
          .syncFoodEntries(nextEntries)
          .then(() => {
            setSyncStatus("synced");
            setSyncError("");
          })
          .catch((error) => {
            setSyncStatus("error");
            setSyncError(error.message || "Failed to sync food entries.");
          });
      }
    },
    updateFoodEntry: (id, updates) =>
      {
        const nextEntries = state.foodEntries.map((entry) =>
          entry.id === id ? { ...entry, ...updates } : entry
        );
        dispatch({ type: "hydrate", payload: { foodEntries: nextEntries } });
        if (storageCapabilities.supportsGranularSync) {
          setSyncStatus("saving");
          appStorage
            .syncFoodEntries(nextEntries)
            .then(() => {
              setSyncStatus("synced");
              setSyncError("");
            })
            .catch((error) => {
              setSyncStatus("error");
              setSyncError(error.message || "Failed to sync food entries.");
            });
        }
      },
    deleteFoodEntry: (id) => {
      const nextEntries = state.foodEntries.filter((entry) => entry.id !== id);
      dispatch({ type: "hydrate", payload: { foodEntries: nextEntries } });
      if (storageCapabilities.supportsGranularSync) {
        setSyncStatus("saving");
        appStorage
          .syncFoodEntries(nextEntries)
          .then(() => {
            setSyncStatus("synced");
            setSyncError("");
          })
          .catch((error) => {
            setSyncStatus("error");
            setSyncError(error.message || "Failed to sync food entries.");
          });
      }
    },
    addMealTemplate: (meal) => {
      const existing = state.mealTemplates.find(
        (entry) =>
          entry.name.toLowerCase() === meal.name.toLowerCase() &&
          (entry.templateType || "meal") === (meal.templateType || "meal") &&
          entry.servingSize.toLowerCase() === meal.servingSize.toLowerCase()
      );
      const nextMeals = existing
        ? state.mealTemplates.map((entry) =>
            entry.id === existing.id ? { ...entry, ...meal } : entry
          )
        : [{ id: createId(), ...meal }, ...state.mealTemplates];
      dispatch({ type: "hydrate", payload: { mealTemplates: nextMeals } });
      if (storageCapabilities.supportsGranularSync) {
        setSyncStatus("saving");
        appStorage
          .syncMealTemplates(nextMeals)
          .then(() => {
            setSyncStatus("synced");
            setSyncError("");
          })
          .catch((error) => {
            setSyncStatus("error");
            setSyncError(error.message || "Failed to sync saved meals.");
          });
      }
    },
    deleteMealTemplate: (id) => {
      const nextMeals = state.mealTemplates.filter((meal) => meal.id !== id);
      dispatch({ type: "hydrate", payload: { mealTemplates: nextMeals } });
      if (storageCapabilities.supportsGranularSync) {
        setSyncStatus("saving");
        appStorage
          .syncMealTemplates(nextMeals)
          .then(() => {
            setSyncStatus("synced");
            setSyncError("");
          })
          .catch((error) => {
            setSyncStatus("error");
            setSyncError(error.message || "Failed to sync saved meals.");
          });
      }
    },
    saveCustomWorkoutSystem: (system) => {
      const nextSystem = {
        ...system,
        id: system.id || createId(),
        workouts: system.workouts.map((workout) => ({
          ...workout,
          id: workout.id || createId(),
        })),
      };
      const exists = state.customWorkoutSystems.some((entry) => entry.id === nextSystem.id);
      const nextSystems = exists
        ? state.customWorkoutSystems.map((entry) =>
            entry.id === nextSystem.id ? nextSystem : entry
          )
        : [nextSystem, ...state.customWorkoutSystems];
      dispatch({ type: "hydrate", payload: { customWorkoutSystems: nextSystems } });
      if (storageCapabilities.supportsGranularSync) {
        setSyncStatus("saving");
        appStorage
          .syncCustomWorkoutSystems(nextSystems)
          .then(() => {
            setSyncStatus("synced");
            setSyncError("");
          })
          .catch((error) => {
            setSyncStatus("error");
            setSyncError(error.message || "Failed to sync workout systems.");
          });
      }
    },
    deleteCustomWorkoutSystem: (id) => {
      const nextSystems = state.customWorkoutSystems.filter((system) => system.id !== id);
      dispatch({ type: "hydrate", payload: { customWorkoutSystems: nextSystems } });
      if (storageCapabilities.supportsGranularSync) {
        setSyncStatus("saving");
        appStorage
          .syncCustomWorkoutSystems(nextSystems)
          .then(() => {
            setSyncStatus("synced");
            setSyncError("");
          })
          .catch((error) => {
            setSyncStatus("error");
            setSyncError(error.message || "Failed to sync workout systems.");
          });
      }
    },
    addWeightEntry: (entry) => {
      const existing = state.weightEntries.find((item) => item.date === entry.date);
      const nextWeights = existing
        ? state.weightEntries.map((item) =>
            item.id === existing.id ? { ...item, weight: entry.weight, notes: entry.notes || "" } : item
          )
        : [{ id: createId(), ...entry }, ...state.weightEntries];
      dispatch({ type: "hydrate", payload: { weightEntries: nextWeights } });
      if (storageCapabilities.supportsGranularSync) {
        setSyncStatus("saving");
        appStorage
          .syncWeightEntries(nextWeights)
          .then(() => {
            setSyncStatus("synced");
            setSyncError("");
          })
          .catch((error) => {
            setSyncStatus("error");
            setSyncError(error.message || "Failed to sync weight entries.");
          });
      }
    },
    deleteWeightEntry: (id) => {
      const nextWeights = state.weightEntries.filter((entry) => entry.id !== id);
      dispatch({ type: "hydrate", payload: { weightEntries: nextWeights } });
      if (storageCapabilities.supportsGranularSync) {
        setSyncStatus("saving");
        appStorage
          .syncWeightEntries(nextWeights)
          .then(() => {
            setSyncStatus("synced");
            setSyncError("");
          })
          .catch((error) => {
            setSyncStatus("error");
            setSyncError(error.message || "Failed to sync weight entries.");
          });
      }
    },
    addWorkoutEntry: (entry) => {
      const nextEntries = [{ id: createId(), ...entry }, ...state.workoutEntries];
      dispatch({ type: "hydrate", payload: { workoutEntries: nextEntries } });
      if (storageCapabilities.supportsGranularSync) {
        setSyncStatus("saving");
        appStorage
          .syncWorkoutEntries(nextEntries)
          .then(() => {
            setSyncStatus("synced");
            setSyncError("");
          })
          .catch((error) => {
            setSyncStatus("error");
            setSyncError(error.message || "Failed to sync workout entries.");
          });
      }
    },
    deleteWorkoutEntry: (id) => {
      const nextEntries = state.workoutEntries.filter((entry) => entry.id !== id);
      dispatch({ type: "hydrate", payload: { workoutEntries: nextEntries } });
      if (storageCapabilities.supportsGranularSync) {
        setSyncStatus("saving");
        appStorage
          .syncWorkoutEntries(nextEntries)
          .then(() => {
            setSyncStatus("synced");
            setSyncError("");
          })
          .catch((error) => {
            setSyncStatus("error");
            setSyncError(error.message || "Failed to sync workout entries.");
          });
      }
    },
    updateSettings: (settings) => {
      const nextSettings = { ...state.settings, ...settings };
      dispatch({ type: "hydrate", payload: { settings: nextSettings } });
      if (storageCapabilities.supportsGranularSync) {
        setSyncStatus("saving");
        appStorage
          .syncSettings(nextSettings)
          .then(() => {
            setSyncStatus("synced");
            setSyncError("");
          })
          .catch((error) => {
            setSyncStatus("error");
            setSyncError(error.message || "Failed to sync settings.");
          });
      }
    },
    setSelectedDate: (date) => dispatch({ type: "setSelectedDate", payload: date }),
  };
}
