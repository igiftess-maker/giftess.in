

// Default WhatsApp number (overridden from store_settings)
const DEFAULT_WA = '916002698296';
window.supabaseClient = supabase;




// config.js

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

console.log("✅ config.js loaded");

// 🔴 PUT YOUR REAL VALUES HERE
const SUPABASE_URL = "https://wvobmpujirwvonkbkffz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_KVWGzSiKNtEYIp0LnUtW9w_tl0BTOle";

// ✅ Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// ✅ Expose globally (important for main.js)
window.supabase = supabase;

console.log("✅ Supabase client ready", supabase);

// 🧪 TEST QUERY (must work)
(async () => {
  console.log("🧪 Running Supabase test query...");

  const { data, error } = await supabase
    .from("products")
    .select("id, name")
    .limit(1);

  console.log("🧪 Supabase test result:", data, error);
})();
