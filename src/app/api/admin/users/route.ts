import { NextResponse } from "next/server";
import { getSupabaseAdmin, getVerifiedServerIdentity } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  const identity = await getVerifiedServerIdentity(request);
  if (!identity || identity.profile.role !== "admin" || identity.profile.account_status !== "active") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = getSupabaseAdmin();
  const { data, error } = await admin!.from("profiles").select("id,display_name,role,account_status,created_at").order("created_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: "Unable to load accounts" }, { status: 500 });
  return NextResponse.json({ accounts: data });
}
