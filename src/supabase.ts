import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, "");

const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY"
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
);
