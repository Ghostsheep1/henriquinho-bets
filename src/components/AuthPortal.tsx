"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Apple, Globe2, Loader2, ShieldCheck } from "lucide-react";
import HenriquinhoApp from "@/components/HenriquinhoApp";
import { canResendVerification, isAdultBirthDate, mayAccessPlayer, type AccountStatus, type AppRole } from "@/lib/auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Profile = { display_name: string; balance: number; role: AppRole; account_status: AccountStatus; is_guest: boolean };
type Screen = "login" | "signup" | "forgot" | "reset" | "verify";

function redirectUrl(path = "/") {
  return `${window.location.origin}${path}`;
}

export default function AuthPortal({ screen = "login", redirectAuthenticated = false }: { screen?: Screen; redirectAuthenticated?: boolean }) {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [destination, setDestination] = useState("/");
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
  const appleEnabled = process.env.NEXT_PUBLIC_APPLE_AUTH_ENABLED === "true";

  const activeScreen = useMemo<Screen>(() => screen, [screen]);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("next");
    setDestination(requested?.startsWith("/") ? requested : "/");
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) { setSessionReady(true); return; }
    let alive = true;
    const load = async () => {
      const { data } = await client.auth.getUser();
      const user = data.user;
      if (!alive || (!user?.email_confirmed_at && !user?.is_anonymous)) { setSessionReady(true); return; }
      setEmail(user.email ?? "");
      const metadata = user.user_metadata ?? {};
      const pending = typeof window !== "undefined" ? window.sessionStorage.getItem("henriquinho-pending-profile") : null;
      const pendingProfile = pending ? JSON.parse(pending) as { name?: string; birthDate?: string; acceptedTerms?: boolean } : null;
      const metadataBirthDate = typeof metadata.birth_date === "string" ? metadata.birth_date : pendingProfile?.birthDate ?? "";
      if (metadataBirthDate && isAdultBirthDate(metadataBirthDate) && (metadata.terms_accepted === true || pendingProfile?.acceptedTerms === true)) {
        await client.rpc("complete_my_profile", {
          next_name: typeof metadata.display_name === "string" ? metadata.display_name : typeof metadata.full_name === "string" ? metadata.full_name : typeof metadata.name === "string" ? metadata.name : pendingProfile?.name ?? "",
          next_birth_date: metadataBirthDate,
          accepted_terms: metadata.terms_accepted === true || pendingProfile?.acceptedTerms === true,
        });
        window.sessionStorage.removeItem("henriquinho-pending-profile");
      }
      if (user.is_anonymous) await client.rpc("ensure_my_guest_profile");
      const result = await client.from("profiles").select("display_name,balance,role,account_status,is_guest").eq("id", user.id).maybeSingle();
      if (!alive) return;
      setProfile(result.data as Profile | null);
      setSessionReady(true);
    };
    load();
    const { data: listener } = client.auth.onAuthStateChange(() => { load(); });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (profile && redirectAuthenticated) router.replace(destination);
  }, [destination, profile, redirectAuthenticated, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (activeScreen === "signup") {
        if (!isAdultBirthDate(birthDate)) throw new Error("You must be at least 18 years old to create an account.");
        if (!termsAccepted) throw new Error("You must accept the Terms of Service and Privacy Policy.");
        const { error: signUpError } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl("/login"), data: { display_name: name.trim(), birth_date: birthDate, terms_accepted: true } } });
        if (signUpError) throw signUpError;
        const { data: current } = await supabase.auth.getUser();
        if (current.user?.email_confirmed_at) await supabase.rpc("complete_my_profile", { next_name: name.trim(), next_birth_date: birthDate, accepted_terms: true });
        setNotice("Check your email to verify your account before signing in.");
      } else if (activeScreen === "login") {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        if (!data.user.email_confirmed_at) { await supabase.auth.signOut(); router.push(`/verify?email=${encodeURIComponent(email)}`); return; }
        router.replace(destination);
      } else if (activeScreen === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl("/reset-password") });
        if (resetError) throw resetError;
        setNotice("Password reset email sent.");
      } else if (activeScreen === "reset") {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setNotice("Password updated. You can now sign in.");
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Authentication failed"); }
    finally { setBusy(false); }
  };

  const oauth = async (provider: "google" | "apple") => {
    if (!supabase) return;
    if (provider === "google" && !googleEnabled) { setError("Google sign-in is not available yet."); return; }
    if (provider === "apple" && !appleEnabled) { setError("Apple sign-in is not available yet."); return; }
    if (activeScreen === "signup") {
      if (!isAdultBirthDate(birthDate)) { setError("You must be at least 18 years old to create an account."); return; }
      if (!termsAccepted) { setError("You must accept the Terms of Service and Privacy Policy."); return; }
      window.sessionStorage.setItem("henriquinho-pending-profile", JSON.stringify({ name: name.trim(), birthDate, acceptedTerms: true }));
    }
    setBusy(true); setError("");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirectUrl(destination) } });
    if (oauthError) { setError(provider === "google" ? "Google sign-in is not available yet." : "Apple sign-in is not available yet."); setBusy(false); }
  };

  const tryGuest = async () => {
    if (!supabase) return;
    setBusy(true); setError(""); setNotice("");
    const { error: guestError } = await supabase.auth.signInAnonymously();
    setBusy(false);
    if (guestError) setError("Guest access is not available right now. Please try again later.");
  };

  const resend = async () => {
    if (!supabase || !canResendVerification(resendAt)) return;
    setBusy(true); setError("");
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: redirectUrl("/login") } });
    setBusy(false);
    if (resendError) setError(resendError.message); else { setResendAt(Date.now()); setNotice("Verification email resent. Please wait one minute before requesting another."); }
  };

  const signOut = async () => { await supabase?.auth.signOut(); setProfile(null); router.replace("/login"); };

  if (!isSupabaseConfigured) return <AuthShell title="Authentication setup required"><p className="text-sm text-slate-300">Add the Supabase URL and publishable key to enable sign-in.</p></AuthShell>;
  if (!sessionReady) return <AuthShell title="Checking session"><Loader2 className="animate-spin text-emerald-300" /></AuthShell>;
  if (profile) {
    if (!mayAccessPlayer(profile.account_status)) return <AuthShell title="Account unavailable"><p className="text-sm text-slate-300">This account is {profile.account_status}. Contact support for help.</p><button onClick={signOut} className="mt-4 rounded bg-emerald-400 px-4 py-2 font-bold text-black">Sign out</button></AuthShell>;
    return <HenriquinhoApp authenticatedUser={{ name: profile.display_name, email, admin: profile.role === "admin", guest: profile.is_guest, balance: profile.balance }} onAuthenticatedSignOut={signOut} />;
  }

  const verify = activeScreen === "verify";
  return <AuthShell title={verify ? "Verify your email" : activeScreen === "signup" ? "Create your account" : activeScreen === "forgot" ? "Reset password" : activeScreen === "reset" ? "Choose a new password" : "Welcome back"}>
    <form onSubmit={submit} className="space-y-3">
      {activeScreen === "signup" && <><Field label="Name" value={name} onChange={setName} autoComplete="name" /><Field label="Date of birth" value={birthDate} onChange={setBirthDate} type="date" autoComplete="bday" /><label className="flex gap-2 text-sm text-slate-200"><input required checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} type="checkbox" className="mt-1 accent-emerald-300" /><span>I am 18 or older and accept the <a className="underline text-emerald-200" href="/terms">Terms of Service</a> and <a className="underline text-emerald-200" href="/privacy">Privacy Policy</a>.</span></label></>}
      {activeScreen !== "reset" && <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />}
      {!verify && activeScreen !== "forgot" && <Field label="Password" value={password} onChange={setPassword} type="password" autoComplete={activeScreen === "signup" ? "new-password" : "current-password"} />}
      {verify ? <button type="button" disabled={busy || !canResendVerification(resendAt)} onClick={resend} className="w-full rounded bg-emerald-400 py-3 font-black text-black disabled:opacity-50">Resend verification email</button> : <button disabled={busy} className="w-full rounded bg-emerald-400 py-3 font-black text-black disabled:opacity-50">{busy ? "Please wait" : activeScreen === "signup" ? "Create account" : activeScreen === "forgot" ? "Send reset email" : activeScreen === "reset" ? "Update password" : "Sign in"}</button>}
      {(activeScreen === "login" || activeScreen === "signup") && <><button type="button" disabled={busy} onClick={tryGuest} className="w-full rounded border border-amber-300/40 bg-amber-300/10 py-3 font-black text-amber-100 disabled:opacity-50">Try as Guest</button><p className="text-center text-xs text-slate-400">Guest progress is saved on this browser. Create an account later to keep it across devices.</p><div className="flex items-center gap-3 text-xs text-slate-500"><span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" /></div><button type="button" disabled={busy || !googleEnabled} onClick={() => oauth("google")} className="flex w-full items-center justify-center gap-2 rounded border border-white/15 py-3 font-bold disabled:cursor-not-allowed disabled:opacity-45"><Globe2 className="h-4 w-4" />{googleEnabled ? "Continue with Google" : "Google coming soon"}</button><button type="button" disabled={busy || !appleEnabled} onClick={() => oauth("apple")} className="flex w-full items-center justify-center gap-2 rounded border border-white/15 py-3 font-bold disabled:cursor-not-allowed disabled:opacity-45"><Apple className="h-4 w-4" />{appleEnabled ? "Continue with Apple" : "Apple coming soon"}</button></>}
    </form>
    {notice && <p className="mt-4 rounded bg-emerald-400/10 p-3 text-sm text-emerald-100">{notice}</p>}{error && <p className="mt-4 rounded bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}
    <div className="mt-5 flex flex-wrap gap-3 text-sm text-emerald-200">{activeScreen !== "login" && <a href="/login">Sign in</a>}{activeScreen !== "signup" && activeScreen !== "forgot" && <a href="/signup">Create account</a>}{activeScreen !== "forgot" && <a href="/forgot-password">Forgot password?</a>}</div>
  </AuthShell>;
}

function Field({ label, value, onChange, type = "text", autoComplete }: { label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string }) { return <label className="block text-sm font-bold text-slate-200">{label}<input required type={type} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/30 px-3 py-3 outline-none ring-emerald-300 focus:ring-2" /></label>; }
function AuthShell({ title, children }: { title: string; children: React.ReactNode }) { return <main className="flex min-h-screen items-center justify-center bg-[#070a0c] p-4 text-slate-100"><section className="w-full max-w-md rounded-md border border-white/10 bg-[#0b1210] p-6 shadow-2xl"><div className="mb-4 flex items-center gap-3"><ShieldCheck className="h-7 w-7 text-emerald-300" /><div><div className="font-black text-amber-300">HenriquinhoBets</div><h1 className="text-2xl font-black">{title}</h1></div></div>{children}</section></main>; }
