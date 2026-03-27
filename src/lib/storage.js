import { localStorageAdapter } from "./storage.local";
import { supabaseStorageAdapter } from "./storage.supabase";
import { hasSupabaseConfig } from "./supabase";

export const appStorage = hasSupabaseConfig ? supabaseStorageAdapter : localStorageAdapter;

export const storageCapabilities = {
  hasCloudConfig: hasSupabaseConfig,
  supportsGranularSync: hasSupabaseConfig,
};
