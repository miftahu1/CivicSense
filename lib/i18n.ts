import type { Language, Priority, Report, ReportStatus } from "@/lib/types";

export type InterfaceLanguage = "en" | "as";

export function tr(language: InterfaceLanguage, english: string, assamese: string) {
  return language === "as" ? assamese : english;
}

const statusLabels: Record<InterfaceLanguage, Record<ReportStatus, string>> = {
  en: { "Under review": "Under review", Investigating: "Investigating", "In progress": "In progress", "Awaiting admin review": "Awaiting admin review", Resolved: "Resolved" },
  as: { "Under review": "পৰ্যালোচনাধীন", Investigating: "অনুসন্ধান চলি আছে", "In progress": "কাম চলি আছে", "Awaiting admin review": "প্ৰশাসকৰ পৰ্যালোচনাৰ অপেক্ষাত", Resolved: "সমাধান কৰা হ’ল" },
};

const priorityLabels: Record<InterfaceLanguage, Record<Priority, string>> = {
  en: { Low: "Low", Medium: "Medium", High: "High", Urgent: "Urgent" },
  as: { Low: "কম", Medium: "মধ্যম", High: "উচ্চ", Urgent: "জৰুৰী" },
};

const categoryLabels: Record<InterfaceLanguage, Record<Report["category"], string>> = {
  en: {
    "Infrastructure": "Infrastructure",
    "Utilities": "Utilities",
    "Safety and Security": "Safety and Security",
    "Transportation": "Transportation",
    "Environmental": "Environmental",
    "Administrative": "Administrative",
    "Student Life": "Student Life",
    "Faculty Support": "Faculty Support",
    "Events and Activities": "Events and Activities",
    "Technology and IT": "Technology and IT",
    "Health and Wellness": "Health and Wellness",
    "Other": "Other",
  },
  as: {
    "Infrastructure": "আন্তঃগাঁথনি",
    "Utilities": "উপযোগিতা",
    "Safety and Security": "নিৰাপত্তা আৰু সুৰক্ষা",
    "Transportation": "পৰিবহণ",
    "Environmental": "পৰিৱেশ",
    "Administrative": "প্ৰশাসনিক",
    "Student Life": "ছাত্ৰ জীৱন",
    "Faculty Support": "শিক্ষক সহায়",
    "Events and Activities": "অনুষ্ঠান আৰু কাৰ্যকলাপ",
    "Technology and IT": "প্ৰযুক্তি আৰু তথ্য প্ৰযুক্তি",
    "Health and Wellness": "স্বাস্থ্য আৰু সুস্থতা",
    "Other": "অন্যান্য",
  },
};

export function statusLabel(status: ReportStatus, language: InterfaceLanguage) {
  return statusLabels[language][status];
}

export function priorityLabel(priority: Priority, language: InterfaceLanguage) {
  return priorityLabels[language][priority];
}

export function categoryLabel(category: Report["category"], language: InterfaceLanguage) {
  return categoryLabels[language][category];
}

export function reportTitle(report: Report, language: InterfaceLanguage) {
  return language === "as" ? report.titleAs || report.titleEn : report.titleEn;
}

export function reportSummary(report: Report, language: InterfaceLanguage) {
  return language === "as" ? report.summaryAs || report.summaryEn : report.summaryEn;
}

export function languageLabel(language: Language, interfaceLanguage: InterfaceLanguage) {
  if (interfaceLanguage === "en") return language;
  return {
    English: "ইংৰাজী",
    Assamese: "অসমীয়া",
    "Romanised Assamese": "ৰোমানাইজড অসমীয়া",
    Mixed: "মিশ্ৰ ভাষা",
  }[language];
}

export function roleLabel(role: "student" | "staff" | "admin", language: InterfaceLanguage) {
  if (language === "en") return role === "admin" ? "Administrator" : role === "staff" ? "Staff" : "Student";
  return role === "admin" ? "প্ৰশাসক" : role === "staff" ? "কৰ্মচাৰী" : "ছাত্ৰ";
}
