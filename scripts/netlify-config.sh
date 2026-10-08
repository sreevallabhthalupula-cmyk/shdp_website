#!/bin/sh
# Netlify build step: write js/supabase-config.js from environment variables.
# No Node, no packages. Fails the deploy rather than ever publishing a secret key.
set -eu

url="${SUPABASE_URL:-}"
key="${SUPABASE_ANON_KEY:-}"
out="js/supabase-config.js"

if [ -z "$url" ] || [ -z "$key" ]; then
  echo "netlify-config: SUPABASE_URL / SUPABASE_ANON_KEY not set; registration form stays closed."
  exit 0
fi

# shape checks (also stop anything that could break out of the JS string)
echo "$url" | grep -Eq '^https://[a-z0-9-]+\.supabase\.co$' || { echo "netlify-config: SUPABASE_URL must look like https://<project>.supabase.co"; exit 1; }
echo "$key" | grep -Eq '^[A-Za-z0-9._-]+$' || { echo "netlify-config: SUPABASE_ANON_KEY has unexpected characters"; exit 1; }

# never publish a secret key
case "$key" in
  sb_secret_*) echo "netlify-config: refusing a secret key. Use the publishable / anon key."; exit 1 ;;
esac
payload=$(printf '%s' "$key" | cut -d. -f2 | tr '_-' '/+')
if [ -n "$payload" ] && [ "$payload" != "$key" ]; then
  pad=$(( (4 - ${#payload} % 4) % 4 ))
  [ "$pad" -gt 0 ] && payload="$payload$(printf '%*s' "$pad" '' | tr ' ' '=')"
  if printf '%s' "$payload" | base64 -d 2>/dev/null | grep -q '"role" *: *"service_role"'; then
    echo "netlify-config: refusing a service_role key. Use the anon key."; exit 1
  fi
fi

cat > "$out" <<EOF
/* Generated at deploy time by scripts/netlify-config.sh. Public values only. */
window.SHDP_BACKEND = { supabaseUrl: "$url", supabaseAnonKey: "$key" };
EOF
echo "netlify-config: wrote $out for $url"
