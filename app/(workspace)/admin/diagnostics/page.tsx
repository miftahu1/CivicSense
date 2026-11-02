import { redirect } from "next/navigation";
import { AiDiagnostics } from "@/components/ai-diagnostics";
import { requireUser } from "@/lib/supabase/server";

export default async function AiDiagnosticsPage() {
  let role: "student" | "staff" | "admin";
  try {
    const { profile } = await requireUser();
    role = profile.role;
  } catch {
    redirect("/login");
  }

  if (role !== "admin") redirect(role === "staff" ? "/staff" : "/app");
  return <AiDiagnostics/>;
}
