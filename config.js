

// ─────────────────────────────────────────
//  Giftess – Supabase Configuration
// ─────────────────────────────────────────
const SUPABASE_URL      = "https://wwobmpujirwvonkbkffz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_KVWGzSiKNtEYIp0LnUtW9w_tl0BTOle";

// Default WhatsApp number (overridden from store_settings)
const DEFAULT_WA = '916002698296';
window.supabaseClient = supabase;
console.log("✅ Supabase client ready", supabase);
(async () => {
  console.log("🧪 Running Supabase test query...");

  const { data, error } = await supabase
    .from("products")
    .select("id, name")
    .limit(1);

  console.log("🧪 Supabase test result:", data, error);
})();
