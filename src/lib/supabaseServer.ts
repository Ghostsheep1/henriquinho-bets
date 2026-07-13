import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getVerifiedServerIdentity(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const admin = getSupabaseAdmin();
  if (!admin || !token) return null;
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user?.email_confirmed_at) return null;
  const { data: profile } = await admin.from("profiles").select("id,display_name,role,account_status").eq("id", user.id).maybeSingle();
  if (!profile) return null;
  return { user, profile };
}
