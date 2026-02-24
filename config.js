// config.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

console.log("✅ config.js loaded");

// 🔑 Supabase credentials
const SUPABASE_URL = "https://wwobmpujirwvonkbkffz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_KVWGzSiKNtEYIp0LnUtW9w_tl0BTOle";

// ✅ Create client FIRST
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// ✅ THEN expose globally
window.supabase = supabase;

console.log("✅ Supabase client ready");

// 🧪 Test query (must run without error)
(async () => {
  console.log("🧪 Running Supabase test query...");
  const { data, error } = await supabase
    .from("products")
    .select("id, name")
    .limit(1);

  console.log("🧪 Supabase test result:", data, error);
})();

// Default WhatsApp number (overridden from store_settings)
const DEFAULT_WA = '916002698296';






