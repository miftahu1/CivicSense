export const campusDepartments = [
  "Facilities & Maintenance",
  "Electrical Services",
  "IT Services",
  "Library Services",
  "Sanitation & Waste",
  "Student Housing",
  "Health Services",
  "Campus Security",
  "Transport & Parking",
] as const;

export type CampusDepartment = (typeof campusDepartments)[number];

const aliases: Record<string, CampusDepartment> = {
  facilities: "Facilities & Maintenance",
  facility: "Facilities & Maintenance",
  facilitiesandmaintenance: "Facilities & Maintenance",
  maintenance: "Facilities & Maintenance",
  maintenancedepartment: "Facilities & Maintenance",
  buildingmaintenance: "Facilities & Maintenance",
  electrical: "Electrical Services",
  electricaldepartment: "Electrical Services",
  electricalwing: "Electrical Services",
  electricalmaintenance: "Electrical Services",
  it: "IT Services",
  itdepartment: "IT Services",
  technologyandit: "IT Services",
  technologyservices: "IT Services",
  computerservices: "IT Services",
  library: "Library Services",
  libraryadministration: "Library Services",
  librarydepartment: "Library Services",
  sanitation: "Sanitation & Waste",
  waste: "Sanitation & Waste",
  sanitationandwaste: "Sanitation & Waste",
  janitorial: "Sanitation & Waste",
  cleaning: "Sanitation & Waste",
  studenthousing: "Student Housing",
  hostel: "Student Housing",
  hosteladministration: "Student Housing",
  hostelmaintenance: "Student Housing",
  housing: "Student Housing",
  health: "Health Services",
  healthcentre: "Health Services",
  healthcenter: "Health Services",
  medicalservices: "Health Services",
  security: "Campus Security",
  campussecurity: "Campus Security",
  transport: "Transport & Parking",
  transportation: "Transport & Parking",
  parking: "Transport & Parking",
};

function key(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function normalizeDepartment(value: string | null | undefined): CampusDepartment | null {
  if (!value?.trim()) return null;
  const normalized = key(value);
  return campusDepartments.find((department) => key(department) === normalized) || aliases[normalized] || null;
}
