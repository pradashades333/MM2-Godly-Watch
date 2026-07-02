import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Feature flag: without Supabase env vars the account UI is hidden entirely
// and the site behaves exactly as before.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
export const accountsEnabled = Boolean(supabase);
