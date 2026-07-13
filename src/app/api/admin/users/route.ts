import { NextResponse } from "next/server";
import { getVerifiedServerIdentity } from "@/lib/supabaseServer";

export async function GET() {
  const identity = await getVerifiedServerIdentity();
  if (!identity || identity.profile.role !== "admin" || identity.profile.account_status !== "active") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await identity.supabase.rpc("admin_list_accounts");
  if (error) return NextResponse.json({ error: "Unable to load accounts" }, { status: 500 });
  return NextResponse.json({ accounts: data });
}
