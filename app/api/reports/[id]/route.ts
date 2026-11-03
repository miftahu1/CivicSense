import { loadReports } from "@/lib/db-mappers";
import { authErrorResponse, requireUser } from "@/lib/supabase/server";
import { normalizeDepartment } from "@/lib/departments";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { admin, profile } = await requireUser();
    const { data: row, error } = await admin.from("reports").select("*").eq("id", id).eq("is_synthetic", false).maybeSingle();
    if (error) throw error;
    const assignedStaff = profile.role === "staff" && Boolean(profile.department) && normalizeDepartment(row?.assigned_department) === normalizeDepartment(profile.department);
    if (!row || (profile.role !== "admin" && row.reporter_id !== profile.id && !assignedStaff)) return Response.json({ error: "Report not found." }, { status: 404 });
    const [report] = await loadReports(admin, [row]);
    return Response.json({ report }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { admin, profile } = await requireUser();
    const { data: row, error } = await admin
      .from("reports")
      .select("id, reporter_id, is_synthetic")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!row || row.is_synthetic) return Response.json({ error: "Report not found." }, { status: 404 });
    if (profile.role !== "admin" && row.reporter_id !== profile.id) {
      return Response.json({ error: "Report not found." }, { status: 404 });
    }

    const { data: attachments, error: attachmentError } = await admin
      .from("attachments")
      .select("storage_path")
      .eq("report_id", id);
    if (attachmentError) throw attachmentError;

    const { error: deleteError } = await admin.from("reports").delete().eq("id", id);
    if (deleteError) throw deleteError;

    const storagePaths = (attachments || []).map((attachment) => attachment.storage_path);
    if (storagePaths.length) {
      const { error: storageError } = await admin.storage.from("report-attachments").remove(storagePaths);
      if (storageError) console.error("Deleted report attachment cleanup failed", { reportId: id, error: storageError.message });
    }

    return Response.json({ deleted: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}
