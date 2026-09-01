import { NextResponse } from "next/server";
import { getVerifiedServerIdentity } from "@/lib/supabaseServer";

export async function GET() {
  const identity = await getVerifiedServerIdentity();
  if (!identity || identity.profile.role !== "admin" || identity.profile.account_status !== "active") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await identity.supabase.rpc("admin_list_accounts");
  if (error) return NextResponse.json({ error: "Unable to load accounts" }, { status: 500 });
  return NextResponse.json({ accounts: data });
}

export async function PATCH(request: Request) {
  const identity = await getVerifiedServerIdentity();
  if (!identity || identity.profile.role !== "admin" || identity.profile.account_status !== "active") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { id?: unknown; role?: unknown; accountStatus?: unknown } | null;
  if (!body || typeof body.id !== "string" || (body.role !== "player" && body.role !== "admin") || !["active", "suspended", "locked"].includes(String(body.accountStatus))) {
    return NextResponse.json({ error: "Invalid account update" }, { status: 400 });
  }
  const { data, error } = await identity.supabase.rpc("admin_update_account", { target_id: body.id, next_role: body.role, next_status: body.accountStatus });
  if (error) return NextResponse.json({ error: error.message || "Unable to update account" }, { status: 400 });
  return NextResponse.json({ account: data });
}
