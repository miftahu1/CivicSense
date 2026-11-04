import { normalizeCampusLocationName } from "@/lib/campus-locations";

export type CampusCoordinate = { latitude: number; longitude: number };
export type CampusLocationReference = CampusCoordinate & { id: string; name: string };
export type ResolvedReportLocation = {
  latitude: number | null;
  longitude: number | null;
  source: "gps" | "building" | "unmapped";
  campusLocationId: string | null;
};

export function resolveReportLocation(
  report: { location_building: string; location_latitude: number | null; location_longitude: number | null },
  locations: CampusLocationReference[],
): ResolvedReportLocation {
  const hasGps = typeof report.location_latitude === "number" && Number.isFinite(report.location_latitude)
    && typeof report.location_longitude === "number" && Number.isFinite(report.location_longitude);
  if (hasGps) {
    return {
      latitude: report.location_latitude,
      longitude: report.location_longitude,
      source: "gps",
      campusLocationId: null,
    };
  }

  const building = normalizeCampusLocationName(report.location_building);
  const match = locations.find((location) => normalizeCampusLocationName(location.name) === building);
  if (match) return { latitude: match.latitude, longitude: match.longitude, source: "building", campusLocationId: match.id };
  return { latitude: null, longitude: null, source: "unmapped", campusLocationId: null };
}
