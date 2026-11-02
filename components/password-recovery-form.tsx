"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { Brand } from "@/components/brand";
import { LanguageToggle } from "@/components/language-toggle";
import { useWorkspace } from "@/components/workspace-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { tr } from "@/lib/i18n";

export function PasswordRecoveryForm({ mode }: { mode: "request" | "update" }) {
  const router = useRouter();
  const { locale } = useWorkspace();
  const [email, setEmail] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode !== "update") return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (active && (event === "PASSWORD_RECOVERY" || session)) setReady(true);
    });
    void supabase.auth.getSession().then((result: { data: { session: Session | null } }) => {
      if (active && result.data.session) setReady(true);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [mode]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(tr(locale, "Password recovery is unavailable because Supabase is not configured.", "Supabase সংযোগ কৰা নথকাৰ বাবে পাছৱৰ্ড পুনৰুদ্ধাৰ উপলব্ধ নহয়।"));
      setBusy(false);
      return;
    }
    try {
      const form = new FormData(event.currentTarget);
      if (mode === "request") {
        const address = String(form.get("email") || "").trim();
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(address, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (resetError) throw resetError;
        setEmail(address);
        toast.success(tr(locale, "If an account uses that address, a reset link is on its way.", "এই ঠিকনাৰে একাউণ্ট থাকিলে পাছৱৰ্ড সলনিৰ লিংক পঠিওৱা হৈছে।"));
      } else {
        const password = String(form.get("password") || "");
        const confirmation = String(form.get("confirmPassword") || "");
        if (password !== confirmation) throw new Error(tr(locale, "The passwords do not match.", "পাছৱৰ্ড দুটা মিল নাই।"));
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        await supabase.auth.signOut();
        toast.success(tr(locale, "Password updated. Sign in with your new password.", "পাছৱৰ্ড সলনি কৰা হ’ল। নতুন পাছৱৰ্ডেৰে ছাইন ইন কৰক।"));
        router.replace("/login");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : tr(locale, "We couldn't complete that request.", "অনুৰোধটো সম্পূৰ্ণ কৰিব পৰা নগ’ল।"));
    } finally { setBusy(false); }
  }

  const isRequest = mode === "request";
  return <div className="auth-wrap" lang={locale}>
    <aside className="auth-side"><Brand light/><div><div className="eyebrow" style={{ color: "#bdc7bf", marginBottom: 20 }}><span className="eyebrow-mark"/>{tr(locale, "Campus operations, made clearer", "কেম্পাছ পৰিচালনা, অধিক স্পষ্ট")}</div><h1>{tr(locale, "Your account, back in reach.", "আপোনাৰ একাউণ্ট পুনৰ ব্যৱহাৰ কৰক।")}</h1><p>{tr(locale, "Securely reset your password to return to your campus workspace.", "কেম্পাছ ৱৰ্কস্পেচলৈ উভতি যাবলৈ সুৰক্ষিতভাৱে পাছৱৰ্ড সলনি কৰক।")}</p></div><div className="auth-side-note">Bilingual campus issue workspace</div></aside>
    <main className="auth-main"><section className="auth-card">
      <div className="auth-language-row"><LanguageToggle/></div>
      <div className="section-kicker">{tr(locale, "Account access", "একাউণ্টত প্ৰৱেশ")}</div>
      <h2>{isRequest ? tr(locale, "Reset your password", "পাছৱৰ্ড সলনি কৰক") : tr(locale, "Choose a new password", "নতুন পাছৱৰ্ড বাছক")}</h2>
      <p>{isRequest ? tr(locale, "Enter the email on your account. We’ll send a secure reset link if it’s registered.", "আপোনাৰ একাউণ্টৰ ইমেইল দিয়ক। পঞ্জীয়ন কৰা থাকিলে সুৰক্ষিত লিংক পঠিয়াম।") : ready ? tr(locale, "Choose a new password with at least 8 characters.", "কমেও ৮টা আখৰৰ নতুন পাছৱৰ্ড দিয়ক।") : tr(locale, "Open the password reset link from your email to continue. If it expired, request another one.", "আগবাঢ়িবলৈ ইমেইলত অহা পাছৱৰ্ড সলনিৰ লিংক খোলক। লিংকৰ মেয়াদ পাৰ হ’লে নতুন লিংক বিচাৰক।")}</p>
      {isRequest ? <form onSubmit={submit}>
        <div className="field"><label htmlFor="recovery-email">{tr(locale, "Account email", "একাউণ্টৰ ইমেইল")}</label><input id="recovery-email" name="email" type="email" autoComplete="email" required placeholder="name@institution.edu"/></div>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="button button-primary" type="submit" disabled={busy} style={{ width: "100%", marginTop: 8 }}>{busy ? tr(locale, "Sending link…", "লিংক পঠিওৱা হৈছে…") : tr(locale, "Send reset link", "সলনিৰ লিংক পঠিয়াওক")}</button>
        {email && <p className="field-hint" role="status">{tr(locale, `Check ${email} for the reset link.`, `${email} ঠিকনালৈ অহা সলনিৰ লিংক চাওক।`)}</p>}
      </form> : ready ? <form onSubmit={submit}>
        <div className="field"><label htmlFor="new-password">{tr(locale, "New password", "নতুন পাছৱৰ্ড")}</label><input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={8}/></div>
        <div className="field"><label htmlFor="confirm-password">{tr(locale, "Confirm new password", "নতুন পাছৱৰ্ড নিশ্চিত কৰক")}</label><input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8}/></div>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="button button-primary" type="submit" disabled={busy} style={{ width: "100%", marginTop: 8 }}>{busy ? tr(locale, "Updating…", "সলনি কৰা হৈছে…") : tr(locale, "Update password", "পাছৱৰ্ড সলনি কৰক")}</button>
      </form> : <Link className="button button-primary" style={{ width: "100%", marginTop: 8 }} href="/forgot-password">{tr(locale, "Request another reset link", "আন এটা সলনিৰ লিংক বিচাৰক")}</Link>}
      <div className="auth-switch"><Link href="/login">{tr(locale, "Back to sign in", "ছাইন ইনলৈ উভতি যাওক")}</Link></div>
    </section></main>
  </div>;
}
