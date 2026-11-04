import { z } from "zod";
import { authErrorResponse, requireAdmin, requireUser } from "@/lib/supabase/server";

const locationFields = {
  name: z.string().transform((name) => name.normalize("NFKC").trim().replace(/\s+/g, " ")).pipe(z.string().min(2).max(100)),
  locationType: z.string().transform((type) => type.trim().replace(/\s+/g, " ")).pipe(z.string().min(2).max(60)),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
};
const createLocationSchema = z.object(locationFields);
const updateLocationSchema = z.object({ id: z.string().uuid(), ...locationFields });
const deleteLocationSchema = z.object({ id: z.string().uuid() });

export async function GET() {
  try {
    const { admin } = await requireUser();
    const { data, error } = await admin.from("campus_locations")
      .select("id,name,location_type,latitude,longitude")
      .order("name", { ascending: true });
    if (error) throw error;
    const locations = (data || []).map((location) => ({
      id: location.id,
      name: location.name,
      locationType: location.location_type,
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
    }));
    return Response.json({ locations }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireAdmin();
    const parsed = createLocationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Review the location details." }, { status: 400 });
    const { data, error } = await admin.from("campus_locations").insert({
      name: parsed.data.name,
      location_type: parsed.data.locationType,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      updated_at: new Date().toISOString(),
    }).select("id,name,location_type,latitude,longitude").single();
    if (error?.code === "23505") return Response.json({ error: "A campus location with this name already exists." }, { status: 409 });
    if (error) throw error;
    console.info("Campus location added", { locationId: data.id, actorId: profile.id });
    return Response.json({ location: { id: data.id, name: data.name, locationType: data.location_type, latitude: Number(data.latitude), longitude: Number(data.longitude) } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const { admin, profile } = await requireAdmin();
    const parsed = updateLocationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Review the location details." }, { status: 400 });
    const { id, ...location } = parsed.data;
    const { data, error } = await admin.from("campus_locations").update({
      name: location.name,
      location_type: location.locationType,
      latitude: location.latitude,
      longitude: location.longitude,
      updated_at: new Date().toISOString(),
    }).eq("id", id).select("id,name,location_type,latitude,longitude").maybeSingle();
    if (error?.code === "23505") return Response.json({ error: "A campus location with this name already exists." }, { status: 409 });
    if (error) throw error;
    if (!data) return Response.json({ error: "Campus location not found." }, { status: 404 });
    console.info("Campus location updated", { locationId: id, actorId: profile.id });
    return Response.json({ location: { id: data.id, name: data.name, locationType: data.location_type, latitude: Number(data.latitude), longitude: Number(data.longitude) } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authErrorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const { admin, profile } = await requireAdmin();
    const parsed = deleteLocationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Choose a location to remove." }, { status: 400 });
    const { data, error } = await admin.from("campus_locations").delete().eq("id", parsed.data.id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: "Campus location not found." }, { status: 404 });
    console.info("Campus location removed", { locationId: data.id, actorId: profile.id });
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authErrorResponse(error); }
}
