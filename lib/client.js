import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let client;
export function supabase() {
  if (!url || !key) return null;
  return (client ||= createClient(url, key));
}
export async function googleSignInEnabled(signal) {
  if (!url || !key) return false;
  const response = await fetch(new URL("/auth/v1/settings", url), {
    headers: { apikey: key },
    cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
  });
  return response.ok && (await response.json()).external?.google === true;
}
export async function request(action, fields = {}, signal) {
  const session = (await supabase()?.auth.getSession())?.data?.session;
  const r = await fetch("/api/study", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: "Bearer " + session.access_token } : {}),
    },
    body: JSON.stringify({ action, ...fields }),
    signal,
  });
  const v = await r.json();
  if (!r.ok) throw new Error(v.error || "Request failed.");
  return v;
}
