import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolveReportLocation } from "@/lib/campus-location-resolution";

const migrationPath = fileURLToPath(new URL("../supabase/migrations/202611040001_campus_location_registry.sql", import.meta.url));
const migration = readFileSync(migrationPath, "utf8");
const seedRows = [...migration.matchAll(/\('([^']+)',\s*'([^']+)',\s*(-?\d+(?:\.\d+)?)(?:::\s*double precision)?,\s*(-?\d+(?:\.\d+)?)(?:::\s*double precision)?\)/g)];
assert.equal(seedRows.length, 15, "The registry migration should seed all 15 requested locations.");

const locations = seedRows.map(([, name, locationType, latitude, longitude], index) => ({
  id: `location-${index + 1}`,
  name,
  locationType,
  latitude: Number(latitude),
  longitude: Number(longitude),
}));
const centralLibrary = locations.find((location) => location.name === "Central Library");
assert.ok(centralLibrary, "Central Library should be present in the seed registry.");
assert.deepEqual([centralLibrary.latitude, centralLibrary.longitude], [27.4491203, 94.8972403]);

const buildingFallback = resolveReportLocation({ location_building: " central   library ", location_latitude: null, location_longitude: null }, locations);
assert.deepEqual(buildingFallback, {
  latitude: centralLibrary.latitude,
  longitude: centralLibrary.longitude,
  source: "building",
  campusLocationId: centralLibrary.id,
});

const gpsPriority = resolveReportLocation({ location_building: "Central Library", location_latitude: 27.455, location_longitude: 94.899 }, locations);
assert.deepEqual(gpsPriority, { latitude: 27.455, longitude: 94.899, source: "gps", campusLocationId: null });

const unmatched = resolveReportLocation({ location_building: "Unregistered building", location_latitude: null, location_longitude: null }, locations);
assert.deepEqual(unmatched, { latitude: null, longitude: null, source: "unmapped", campusLocationId: null });

console.log("Campus map checks passed: 15 seeded places, GPS priority, building fallback, and visible-unmapped handling.");
