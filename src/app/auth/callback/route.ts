import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/verify";
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNext(requestUrl.searchParams.get("next"));
  const destination = new URL(next, requestUrl.origin);

  if (!code) {
    destination.searchParams.set("confirmation", "missing");
    return NextResponse.redirect(destination);
  }

  destination.searchParams.set("confirmation", "pending");
  const response = NextResponse.redirect(destination);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    destination.searchParams.set("confirmation", "unavailable");
    return NextResponse.redirect(destination);
  }

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => values.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) destination.searchParams.set("confirmation", "expired");
  else destination.searchParams.set("confirmation", "success");
  response.headers.set("location", destination.toString());
  return response;
}
