import { normalizeDepartment, type CampusDepartment } from "@/lib/departments";
import type { Category } from "@/lib/types";

export const defaultCategoryRoutes: Record<Category, CampusDepartment | null> = {
  "Infrastructure": "Facilities & Maintenance",
  "Utilities": "Facilities & Maintenance",
  "Safety and Security": "Campus Security",
  "Transportation": "Transport & Parking",
  "Environmental": "Sanitation & Waste",
  "Administrative": null,
  "Student Life": "Student Housing",
  "Faculty Support": null,
  "Events and Activities": "Facilities & Maintenance",
  "Technology and IT": "IT Services",
  "Health and Wellness": "Health Services",
  "Other": null,
};

export function resolveDepartmentRoute(category: Category, content: string, categoryRoutes: Partial<Record<Category, string | null>> = {}): CampusDepartment | null {
  const text = content.normalize("NFKC").toLocaleLowerCase();
  if (["Infrastructure", "Utilities", "Safety and Security"].includes(category) && /(electric|electrical|power cut|power outage|short circuit|wiring|lightning|voltage)/i.test(text)) return "Electrical Services";
  if (["Technology and IT", "Utilities", "Infrastructure"].includes(category) && /(internet|wi[ -]?fi|network|router|server|computer|software|portal)/i.test(text)) return "IT Services";
  if (["Health and Wellness", "Safety and Security", "Student Life"].includes(category) && /(collapsed|unconscious|injur|bleed|breath|medical emergency|ambulance|sick|illness)/i.test(text)) return "Health Services";
  if (category === "Safety and Security" && /(theft|stolen|assault|harass|intruder|trespass|threat|security|unauthori[sz]ed access)/i.test(text)) return "Campus Security";
  if (category === "Transportation" && /(bus|shuttle|parking|traffic|vehicle|road transport)/i.test(text)) return "Transport & Parking";
  if (["Environmental", "Utilities"].includes(category) && /(garbage|waste|litter|dirty|cleaning|cleanliness|sanitation|drain smell)/i.test(text)) return "Sanitation & Waste";
  if (["Infrastructure", "Utilities"].includes(category) && /(water leak|pipe leak|plumbing|tap|faucet|drainage)/i.test(text)) return "Facilities & Maintenance";
  const configured = categoryRoutes[category];
  return configured === undefined ? defaultCategoryRoutes[category] : normalizeDepartment(configured);
}
