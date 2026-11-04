"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/brand";
import { LanguageToggle } from "@/components/language-toggle";
import { useWorkspace } from "@/components/workspace-provider";
import { tr } from "@/lib/i18n";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const { locale, activateSession } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [restrictedNotice, setRestrictedNotice] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const isSignup = mode === "signup";
  useEffect(() => {
    const timer = window.setTimeout(() => setRestrictedNotice(new URLSearchParams(window.location.search).get("restricted") === "1"), 0);
    return () => window.clearTimeout(timer);
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim(); const password = String(form.get("password") || "");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError(tr(locale, "Sign in is temporarily unavailable because Supabase is not configured. Contact the campus administrator.", "Supabase ছেটআপ কৰা নথকাৰ বাবে ছাইন ইন কৰিব পৰা নাই। কেম্পাছ প্ৰশাসকৰ সৈতে যোগাযোগ কৰক।")); setBusy(false); return; }
    try {
      if (isSignup) {
        const { data, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: String(form.get("name") || "").trim(), preferred_language: String(form.get("language") || "en") } } });
        if (authError) throw authError;
        if (!data.session) { toast.success(tr(locale, "Account created. Check your email to confirm it, then sign in.", "একাউণ্ট সৃষ্টি কৰা হ’ল। ইমেইল নিশ্চিত কৰি তাৰ পিছত ছাইন ইন কৰক।")); router.replace("/login"); }
        else { const role = await activateSession(); toast.success(tr(locale, "Your account is ready.", "আপোনাৰ একাউণ্ট প্ৰস্তুত।")); router.replace(role === "admin" ? "/admin" : role === "staff" ? "/staff" : "/app"); }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        const role = await activateSession();
        toast.success(tr(locale, "Welcome back.", "পুনৰ স্বাগতম।")); router.replace(role === "admin" ? "/admin" : role === "staff" ? "/staff" : "/app");
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr(locale, "We couldn't complete that request.", "অনুৰোধটো সম্পূৰ্ণ কৰিব পৰা নগ’ল।")); }
    finally { setBusy(false); }
  }
  return <div className="auth-wrap" lang={locale}><aside className="auth-side"><Brand light/><div><div className="eyebrow" style={{color:"#bdc7bf",marginBottom:20}}><span className="eyebrow-mark"/>{tr(locale,"Campus operations, made clearer","কেম্পাছ পৰিচালনা, অধিক স্পষ্ট")}</div><h1>{tr(locale,"Every report is a chance to make","প্ৰতিটো প্ৰতিবেদনেই সুযোগ") } <em>{tr(locale,"something better.","কিবা এটা উন্নত কৰাৰ।")}</em></h1><p>{tr(locale,"One bilingual place to raise campus issues, see related concerns, and follow the work through to resolution.","কেম্পাছৰ সমস্যা জনোৱা, সম্পৰ্কিত অভিযোগ চোৱা আৰু সমাধানলৈকে অনুসৰণ কৰাৰ এক দ্বিভাষিক ঠাই।")}</p></div><div className="auth-side-note">{tr(locale,"Bilingual campus issue workspace","কেম্পাছৰ সমস্যাৰ বাবে দ্বিভাষিক কৰ্মক্ষেত্ৰ")}</div></aside><main className="auth-main"><div className="auth-card"><div className="auth-language-row"><LanguageToggle/></div><div className="section-kicker">{isSignup ? tr(locale,"Join the campus workspace","কেম্পাছ ৱৰ্কস্পেচত যোগ দিয়ক") : tr(locale,"Your campus workspace","আপোনাৰ কেম্পাছ ৱৰ্কস্পেচ")}</div><h2>{isSignup ? tr(locale,"Create your account","একাউণ্ট সৃষ্টি কৰক") : tr(locale,"Welcome back","পুনৰ স্বাগতম")}</h2><p>{isSignup ? tr(locale,"Register with your institutional email to report and track campus issues.","প্ৰতিষ্ঠানৰ ইমেইল ব্যৱহাৰ কৰি কেম্পাছৰ সমস্যা জনাওক আৰু অনুসৰণ কৰক।") : tr(locale,"Sign in to follow your reports and see the latest campus updates.","আপোনাৰ প্ৰতিবেদন অনুসৰণ আৰু কেম্পাছৰ শেহতীয়া আপডেট চাবলৈ ছাইন ইন কৰক।")}</p>{restrictedNotice && !isSignup && <p className="error-text" role="alert">{tr(locale,"Access to this campus workspace is restricted. Contact the campus administrator if you believe this is a mistake.","এই কেম্পাছ ৱৰ্কস্পেচৰ প্ৰৱেশ সীমিত কৰা হৈছে। ভুল বুলি ভাবিলে কেম্পাছ প্ৰশাসকৰ সৈতে যোগাযোগ কৰক।")}</p>}<form onSubmit={submit}>
    {isSignup && <><div className="field"><label htmlFor="name">{tr(locale,"Full name","সম্পূৰ্ণ নাম")}</label><input id="name" name="name" autoComplete="name" placeholder={tr(locale,"Your name","আপোনাৰ নাম")} required minLength={2}/><span className="field-hint">{tr(locale,"Student accounts are created here. Campus staff access is assigned by an administrator.","ইয়াত শিক্ষাৰ্থীৰ একাউণ্ট সৃষ্টি হয়। কেম্পাছৰ কৰ্মচাৰীৰ প্ৰৱেশাধিকাৰ প্ৰশাসকে দিয়ে।")}</span></div></>}
    <div className="field"><label htmlFor="email">{tr(locale,"Institutional email","প্ৰতিষ্ঠানৰ ইমেইল")}</label><input id="email" name="email" type="email" autoComplete="email" placeholder="name@institution.edu" required/></div>
    <div className="field"><label htmlFor="password">{tr(locale,"Password","পাছৱৰ্ড")}</label><div className="password-wrap"><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={isSignup ? "new-password" : "current-password"} placeholder={tr(locale,"At least 8 characters","কমেও ৮টা আখৰ")} required minLength={8} onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))} onBlur={() => setCapsLock(false)}/><button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-pressed={showPassword} aria-label={showPassword ? tr(locale, "Hide password", "পাছৱৰ্ড লুকুৱাওক") : tr(locale, "Show password", "পাছৱৰ্ড দেখুৱাওক")}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>{capsLock && <span className="field-hint caps-hint" role="status">{tr(locale, "Caps Lock is on.", "Caps Lock অন হৈ আছে।")}</span>}</div>
    {isSignup && <div className="field"><label htmlFor="language">{tr(locale,"Preferred language","পছন্দৰ ভাষা")}</label><select id="language" name="language" defaultValue={locale}><option value="en">English</option><option value="as">অসমীয়া</option></select></div>}
    {!isSignup && <div className="auth-forgot-link"><Link href="/forgot-password">{tr(locale, "Forgot your password?", "পাছৱৰ্ড পাহৰিলে নেকি?")}</Link></div>}
    {error && <p className="error-text" role="alert">{error}</p>}<button className="button button-primary" type="submit" disabled={busy} style={{width:"100%",marginTop:8}}>{busy ? tr(locale,"Please wait…","অপেক্ষা কৰক…") : isSignup ? tr(locale,"Create account","একাউণ্ট সৃষ্টি কৰক") : tr(locale,"Sign in","ছাইন ইন")}</button>
  </form><div className="auth-switch">{isSignup ? <>{tr(locale,"Already have an account?","ইতিমধ্যে একাউণ্ট আছে নেকি?")} <Link href="/login">{tr(locale,"Sign in","ছাইন ইন")}</Link></> : <>{tr(locale,"New to CivicSense?","CivicSense-লৈ নতুন নেকি?")} <Link href="/signup">{tr(locale,"Create an account","একাউণ্ট সৃষ্টি কৰক")}</Link></>}</div></div></main></div>;
}
