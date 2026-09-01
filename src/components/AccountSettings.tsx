"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function AccountSettings() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [nextEmail, setNextEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [guest, setGuest] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [fontSize, setFontSize] = useState<"standard" | "large" | "extra-large">("standard");

  const applyAccessibility = (nextTheme: "dark" | "light", nextFontSize: "standard" | "large" | "extra-large") => {
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.dataset.fontSize = nextFontSize;
    localStorage.setItem("henriquinho-accessibility", JSON.stringify({ theme: nextTheme, fontSize: nextFontSize }));
  };

  useEffect(() => {
    const saved = localStorage.getItem("henriquinho-accessibility");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { theme?: "dark" | "light"; fontSize?: "standard" | "large" | "extra-large" };
      const nextTheme = parsed.theme === "light" ? "light" : "dark";
      const nextFontSize = parsed.fontSize === "large" || parsed.fontSize === "extra-large" ? parsed.fontSize : "standard";
      setTheme(nextTheme); setFontSize(nextFontSize); applyAccessibility(nextTheme, nextFontSize);
    } catch { /* Ignore a malformed local preference. */ }
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) { setLoading(false); return; }
    const load = async () => {
      const { data } = await client.auth.getUser();
      if (!data.user || (!data.user.email_confirmed_at && !data.user.is_anonymous)) { router.replace("/login?next=/account"); return; }
      setGuest(Boolean(data.user.is_anonymous));
      setEmail(data.user.email ?? "Guest account");
      setNextEmail(data.user.email ?? "");
      const profile = await client.from("profiles").select("display_name,account_status").eq("id", data.user.id).maybeSingle();
      if (!profile.data || profile.data.account_status !== "active") { router.replace("/login"); return; }
      setName(profile.data.display_name ?? "");
      setLoading(false);
    };
    void load();
  }, [router]);

  const saveName = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(""); setNotice("");
    const { error: updateError } = await supabase.rpc("update_my_display_name", { next_name: name });
    setBusy(false);
    if (updateError) setError(updateError.message); else setNotice("Display name saved.");
  };

  const saveEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || nextEmail === email) return;
    setBusy(true); setError(""); setNotice("");
    const { error: updateError } = await supabase.auth.updateUser({ email: nextEmail });
    setBusy(false);
    if (updateError) setError(updateError.message); else setNotice("Check both email inboxes to confirm this email change before it takes effect.");
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(""); setNotice("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) setError(updateError.message); else { setPassword(""); setNotice("Password updated."); }
  };

  const signOut = async () => { await supabase?.auth.signOut(); router.replace("/login"); };
  const saveAccessibility = (event: React.FormEvent) => { event.preventDefault(); applyAccessibility(theme, fontSize); setNotice("Accessibility preferences saved."); };

  if (!isSupabaseConfigured) return <Shell><p>Supabase public configuration is required.</p></Shell>;
  if (loading) return <Shell><Loader2 className="animate-spin text-emerald-300" /></Shell>;
  return <Shell>
    <div className="flex items-center justify-between gap-4"><div><h1 className="text-2xl font-black">{guest ? "Save your account" : "Account settings"}</h1><p className="text-sm text-slate-400">{guest ? "Add an email and password to keep this same wallet and bet history." : `Signed in as ${email}`}</p></div><button onClick={signOut} className="rounded border border-white/15 px-3 py-2 text-sm font-bold">Sign out</button></div>
    <SettingsForm title="Profile" onSubmit={saveName}><Label label="Display name" value={name} onChange={setName} autoComplete="name" /><button disabled={busy} className="primary">Save name</button></SettingsForm>
    <SettingsForm title={guest ? "Add a verified email" : "Email"} onSubmit={saveEmail}><Label label="Email" value={nextEmail} onChange={setNextEmail} type="email" autoComplete="email" /><p className="text-xs text-slate-400">{guest ? "Supabase will verify this address before this guest account becomes recoverable." : "Changing email requires Supabase verification before the new address becomes active."}</p><button disabled={busy || (!guest && nextEmail === email)} className="primary">{guest ? "Save email" : "Change email"}</button></SettingsForm>
    <SettingsForm title={guest ? "Create a password" : "Password"} onSubmit={savePassword}><Label label="New password" value={password} onChange={setPassword} type="password" autoComplete="new-password" /><button disabled={busy || password.length < 8} className="primary">{guest ? "Save password" : "Change password"}</button></SettingsForm>
    <SettingsForm title="Accessibility" onSubmit={saveAccessibility}><label className="block text-sm font-bold">Appearance<select value={theme} onChange={(event) => setTheme(event.target.value as "dark" | "light")} className="mt-1 w-full rounded border border-white/15 bg-black/30 px-3 py-3"><option value="dark">Dark mode</option><option value="light">Light mode</option></select></label><label className="block text-sm font-bold">Font size<select value={fontSize} onChange={(event) => setFontSize(event.target.value as "standard" | "large" | "extra-large")} className="mt-1 w-full rounded border border-white/15 bg-black/30 px-3 py-3"><option value="standard">Standard</option><option value="large">Large</option><option value="extra-large">Extra large</option></select></label><button className="primary">Save accessibility settings</button></SettingsForm>
    {notice && <p className="rounded bg-emerald-400/10 p-3 text-sm text-emerald-100">{notice}</p>}{error && <p className="rounded bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}
  </Shell>;
}

function Shell({ children }: { children: React.ReactNode }) { return <main className="min-h-screen bg-[#070a0c] p-4 text-slate-100"><section className="mx-auto max-w-xl space-y-4 rounded-md border border-white/10 bg-[#0b1210] p-6"><div className="flex items-center gap-2 text-emerald-300"><ShieldCheck className="h-5 w-5" />Account security</div>{children}</section></main>; }
function SettingsForm({ title, onSubmit, children }: { title: string; onSubmit: (event: React.FormEvent) => void; children: React.ReactNode }) { return <form onSubmit={onSubmit} className="space-y-3 rounded border border-white/10 bg-black/20 p-4"><h2 className="font-black">{title}</h2>{children}</form>; }
function Label({ label, value, onChange, type = "text", autoComplete }: { label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string }) { return <label className="block text-sm font-bold">{label}<input required type={type} minLength={type === "password" ? 8 : undefined} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/30 px-3 py-3 outline-none focus:ring-2 focus:ring-emerald-300" /></label>; }
