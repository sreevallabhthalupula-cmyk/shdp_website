/* Public backend configuration for the Serve & Connect form and the operator dashboard.
   On Netlify this file is REWRITTEN at build time by scripts/netlify-config.sh from the
   environment variables SUPABASE_URL and SUPABASE_ANON_KEY. The committed copy stays empty,
   so the form shows "registration opens shortly" until the variables are set.
   Only the public anon / publishable key may ever appear here: it is safe in a browser
   because Row Level Security allows it nothing except calling submit_registration().
   NEVER put the service_role / secret key in this file or anywhere in this repository. */
window.SHDP_BACKEND = { supabaseUrl: null, supabaseAnonKey: null };
