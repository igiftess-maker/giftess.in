
// config.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

console.log("✅ config.js loaded");

const SUPABASE_URL = "https://wvobmpujirwvonkbkffz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_KVWGzSiKNtEYIp0LnUtW9w_tl0BTOle";

// ✅ Create client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

console.log("✅ Supabase client ready");

// ✅ EXPOSE THE CORRECT VARIABLE
window.supabase = supabase;

// 🧪 TEMP TEST (keep for now)
(async () => {
  console.log("🧪 Running Supabase test query...");
  const { data, error } = await supabase.from("products").select("*");
  console.log("🧪 Supabase test result:", data, error);
})();




