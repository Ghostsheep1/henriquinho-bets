import { NextResponse } from "next/server";
import { getHenriquinhoInternalSports } from "@/lib/henriquinhoSports";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    {
      source: "henriquinho-internal",
      message: "Henriquinho internal sports API loaded. Markets are generated locally and require no external providers.",
      ...getHenriquinhoInternalSports(),
    },
    { headers: { "Cache-Control": "private, max-age=5" } },
  );
}
