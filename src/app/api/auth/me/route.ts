import { NextResponse } from "next/server";
import { getVerifiedServerIdentity } from "@/lib/supabaseServer";

export async function GET() {
  const identity = await getVerifiedServerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (identity.profile.account_status !== "active") return NextResponse.json({ error: "Account unavailable" }, { status: 403 });
  return NextResponse.json({ id: identity.user.id, email: identity.user.email, displayName: identity.profile.display_name, role: identity.profile.role });
}
