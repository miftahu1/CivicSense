"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Brand } from "@/components/brand";
import { LanguageToggle } from "@/components/language-toggle";
import { useWorkspace } from "@/components/workspace-provider";
import { tr } from "@/lib/i18n";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { UserRole } from "@/lib/types";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const { locale } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isSignup = mode === "signup";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim(); const password = String(form.get("password") || "");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError(tr(locale, "Authentication is not connected yet. Add the Supabase URL and anon key to .env.local, or enter the demonstration workspace.", "প্ৰমাণীকৰণ এতিয়াও সংযোগ কৰা হোৱা নাই। .env.local-ত Supabase URL আৰু anon key যোগ কৰক, অথবা ডেম’ ৱৰ্কস্পেচত প্ৰৱেশ কৰক।")); setBusy(false); return; }
    try {
      if (isSignup) {
        const role = String(form.get("role")) as UserRole;
        const { data, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: String(form.get("name") || "").trim(), role, preferred_language: String(form.get("language") || "en") } } });
        if (authError) throw authError;
        if (!data.session) { toast.success(tr(locale, "Account created. Check your email to confirm it, then sign in.", "একাউণ্ট সৃষ্টি কৰা হ’ল। ইমেইল নিশ্চিত কৰি তাৰ পিছত ছাইন ইন কৰক।")); router.push("/login"); }
        else { toast.success(tr(locale, "Your account is ready.", "আপোনাৰ একাউণ্ট প্ৰস্তুত।")); router.push(role === "admin" ? "/admin" : "/app"); }
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        const { data: profile } = data.user ? await supabase.from("profiles").select("role").eq("id", data.user.id).single() : { data: null };
        toast.success(tr(locale, "Welcome back.", "পুনৰ স্বাগতম।")); router.push(profile?.role === "admin" ? "/admin" : "/app");
      }
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr(locale, "We couldn't complete that request.", "অনুৰোধটো সম্পূৰ্ণ কৰিব পৰা নগ’ল।")); }
    finally { setBusy(false); }
  }
  return <div className="auth-wrap" lang={locale}><aside className="auth-side"><Brand light/><div><div className="eyebrow" style={{color:"#bdc7bf",marginBottom:20}}><span className="eyebrow-mark"/>{tr(locale,"Campus operations, made clearer","কেম্পাছ পৰিচালনা, অধিক স্পষ্ট")}</div><h1>{tr(locale,"Every report is a chance to make","প্ৰতিটো প্ৰতিবেদনেই সুযোগ") } <em>{tr(locale,"something better.","কিবা এটা উন্নত কৰাৰ।")}</em></h1><p>{tr(locale,"One bilingual place to raise campus issues, see related concerns, and follow the work through to resolution.","কেম্পাছৰ সমস্যা জনোৱা, সম্পৰ্কিত অভিযোগ চোৱা আৰু সমাধানলৈকে অনুসৰণ কৰাৰ এক দ্বিভাষিক ঠাই।")}</p></div><div className="auth-side-note">Dibrugarh University · Game of Codes 2026</div></aside><main className="auth-main"><div className="auth-card"><div className="auth-language-row"><LanguageToggle/></div><div className="section-kicker">{isSignup ? tr(locale,"Join the campus workspace","কেম্পাছ ৱৰ্কস্পেচত যোগ দিয়ক") : tr(locale,"Your campus workspace","আপোনাৰ কেম্পাছ ৱৰ্কস্পেচ")}</div><h2>{isSignup ? tr(locale,"Create your account","একাউণ্ট সৃষ্টি কৰক") : tr(locale,"Welcome back","পুনৰ স্বাগতম")}</h2><p>{isSignup ? tr(locale,"Register with your university email to report and track campus issues.","বিশ্ববিদ্যালয়ৰ ইমেইল ব্যৱহাৰ কৰি কেম্পাছৰ সমস্যা জনাওক আৰু অনুসৰণ কৰক।") : tr(locale,"Sign in to follow your reports and see the latest campus updates.","আপোনাৰ প্ৰতিবেদন অনুসৰণ আৰু কেম্পাছৰ শেহতীয়া আপডেট চাবলৈ ছাইন ইন কৰক।")}</p><form onSubmit={submit}>
    {isSignup && <><div className="field"><label htmlFor="name">{tr(locale,"Full name","সম্পূৰ্ণ নাম")}</label><input id="name" name="name" autoComplete="name" placeholder={tr(locale,"Your name","আপোনাৰ নাম")} required minLength={2}/></div><div className="field"><label htmlFor="role">{tr(locale,"I am a","মই")}</label><select id="role" name="role" defaultValue="student"><option value="student">{tr(locale,"Student","ছাত্ৰ")}</option><option value="staff">{tr(locale,"University employee / staff","বিশ্ববিদ্যালয়ৰ কৰ্মচাৰী")}</option></select><span className="field-hint">{tr(locale,"Administrator accounts are assigned by the campus operations team.","প্ৰশাসকৰ একাউণ্ট কেম্পাছ পৰিচালনা দলে নিৰ্ধাৰণ কৰে।")}</span></div></>}
    <div className="field"><label htmlFor="email">{tr(locale,"University email","বিশ্ববিদ্যালয়ৰ ইমেইল")}</label><input id="email" name="email" type="email" autoComplete="email" placeholder="name@dibru.ac.in" required/></div>
    <div className="field"><label htmlFor="password">{tr(locale,"Password","পাছৱৰ্ড")}</label><input id="password" name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} placeholder={tr(locale,"At least 8 characters","কমেও ৮টা আখৰ")} required minLength={8}/></div>
    {isSignup && <div className="field"><label htmlFor="language">{tr(locale,"Preferred language","পছন্দৰ ভাষা")}</label><select id="language" name="language" defaultValue={locale}><option value="en">English</option><option value="as">অসমীয়া</option></select></div>}
    {error && <p className="error-text" role="alert">{error}</p>}<button className="button button-primary" type="submit" disabled={busy} style={{width:"100%",marginTop:8}}>{busy ? tr(locale,"Please wait…","অপেক্ষা কৰক…") : isSignup ? tr(locale,"Create account","একাউণ্ট সৃষ্টি কৰক") : tr(locale,"Sign in","ছাইন ইন")}</button>
  </form><div className="auth-switch">{isSignup ? <>{tr(locale,"Already have an account?","ইতিমধ্যে একাউণ্ট আছে নেকি?")} <Link href="/login">{tr(locale,"Sign in","ছাইন ইন")}</Link></> : <>{tr(locale,"New to CivicSense?","CivicSense-লৈ নতুন নেকি?")} <Link href="/signup">{tr(locale,"Create an account","একাউণ্ট সৃষ্টি কৰক")}</Link></>}</div><div className="auth-switch" style={{marginTop:13}}><Link href="/app">{tr(locale,"Continue with synthetic demo data →","কল্পিত ডেম’ তথ্যৰে আগবাঢ়ক →")}</Link></div></div></main></div>;
}
