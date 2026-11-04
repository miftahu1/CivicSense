export type CampusLocation = {
  id: string;
  name: string;
  locationType: string;
  latitude: number;
  longitude: number;
  issueCount?: number;
};

export const CAMPUS_LOCATIONS_UPDATED_EVENT = "civicsense:campus-locations-updated";

export function normalizeCampusLocationName(name: string) {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}
