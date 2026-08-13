import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const PASSWORD_RESET_PATH = "/reset-password";
const PASSWORD_RESET_STORAGE_KEY = "aifit.password-reset-callback";

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: (url, params) => {
          if (
            url.pathname === PASSWORD_RESET_PATH ||
            url.searchParams.get("password-reset") === "1" ||
            params.type === "recovery"
          ) {
            window.sessionStorage.setItem(PASSWORD_RESET_STORAGE_KEY, "1");
          }

          return true;
        },
      },
    })
  : null;
