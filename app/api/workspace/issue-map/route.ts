import { normalizeCampusLocationName } from "@/lib/campus-locations";
import { resolveReportLocation } from "@/lib/campus-location-resolution";
import { normalizeDepartment } from "@/lib/departments";
import { authErrorResponse, requireUser } from "@/lib/supabase/server";

const PAGE_SIZE = 500;
const GPS_RANGE = 180;

type MapLocation = { id: string; name: string; locationType: string; latitude: number; longitude: number; issueCount: number };
type ReportRow = {
  id: string; ticket_number: string; title_en: string | null; title_as: string | null; category: string;
  suggested_priority: string; confirmed_priority: string | null; status: string; location_building: string;
  location_area: string | null; location_latitude: number | null; location_longitude: number | null;
  assigned_department: string | null;
};

function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const toRadians = (degree: number) => degree * Math.PI / 180;
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export async function GET() {
  try {
    const { admin, profile } = await requireUser();
    if (profile.role !== "admin" && profile.role !== "staff") {
      return Response.json({ error: "Administrator or staff access is required." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }

    const { data: locationRows, error: locationsError } = await admin.from("campus_locations")
      .select("id,name,location_type,latitude,longitude").order("name", { ascending: true });
    if (locationsError) throw locationsError;
    const locations: MapLocation[] = (locationRows || []).map((location) => ({
      id: location.id,
      name: location.name,
      locationType: location.location_type,
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      issueCount: 0,
    }));
    const locationReferences = locations.map(({ id, name, latitude, longitude }) => ({ id, name, latitude, longitude }));

    const reports: ReportRow[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await admin.from("reports")
        .select("id,ticket_number,title_en,title_as,category,suggested_priority,confirmed_priority,status,location_building,location_area,location_latitude,location_longitude,assigned_department,is_synthetic")
        .eq("is_synthetic", false)
        .neq("status", "Resolved")
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      const page = (data || []) as unknown as ReportRow[];
      reports.push(...page.filter((report) => profile.role === "admin" || (
        Boolean(profile.department) && normalizeDepartment(report.assigned_department) === normalizeDepartment(profile.department)
      )));
      if (page.length < PAGE_SIZE) break;
    }

    const mapReports = reports.map((report) => {
      const resolvedLocation = resolveReportLocation(report, locationReferences);
      const hasGps = resolvedLocation.source === "gps";
      const buildingLocation = resolvedLocation.campusLocationId
        ? locations.find((location) => location.id === resolvedLocation.campusLocationId)
        : locations.find((location) => normalizeCampusLocationName(location.name) === normalizeCampusLocationName(report.location_building));
      let nearestLocation: (typeof locations)[number] | undefined;
      if (hasGps && locations.length) {
        nearestLocation = locations
          .map((location) => ({ location, distance: distanceMeters({ latitude: report.location_latitude!, longitude: report.location_longitude! }, location) }))
          .sort((a, b) => a.distance - b.distance)[0]?.location;
      }
      const countLocation = hasGps
        ? locations.find((location) => location.id === nearestLocation?.id && distanceMeters({ latitude: report.location_latitude!, longitude: report.location_longitude! }, location) <= GPS_RANGE)
        : buildingLocation;
      if (countLocation) countLocation.issueCount += 1;

      return {
        id: report.id,
        ticketNumber: report.ticket_number,
        titleEn: report.title_en,
        titleAs: report.title_as,
        category: report.category,
        priority: report.confirmed_priority || report.suggested_priority,
        status: report.status,
        building: report.location_building,
        area: report.location_area || "",
        latitude: resolvedLocation.latitude,
        longitude: resolvedLocation.longitude,
        locationSource: resolvedLocation.source,
        campusLocationId: hasGps ? (nearestLocation && countLocation ? nearestLocation.id : null) : resolvedLocation.campusLocationId,
      };
    });

    return Response.json({
      reports: mapReports,
      locations,
      unmappedCount: mapReports.filter((report) => report.locationSource === "unmapped").length,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return authErrorResponse(error);
  }
}
