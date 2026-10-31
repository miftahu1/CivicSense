import type { Language, Priority, Report, ReportStatus } from "@/lib/types";

export type InterfaceLanguage = "en" | "as";

export function tr(language: InterfaceLanguage, english: string, assamese: string) {
  return language === "as" ? assamese : english;
}

const statusLabels: Record<InterfaceLanguage, Record<ReportStatus, string>> = {
  en: { "Under review": "Under review", Investigating: "Investigating", "In progress": "In progress", Resolved: "Resolved" },
  as: { "Under review": "পৰ্যালোচনাধীন", Investigating: "অনুসন্ধান চলি আছে", "In progress": "কাম চলি আছে", Resolved: "সমাধান কৰা হ’ল" },
};

const priorityLabels: Record<InterfaceLanguage, Record<Priority, string>> = {
  en: { Low: "Low", Medium: "Medium", High: "High", Urgent: "Urgent" },
  as: { Low: "কম", Medium: "মধ্যম", High: "উচ্চ", Urgent: "জৰুৰী" },
};

const categoryLabels: Record<InterfaceLanguage, Record<Report["category"], string>> = {
  en: {
    "Water supply / plumbing": "Water supply / plumbing", Electrical: "Electrical", "Internet / network": "Internet / network",
    "Sanitation / waste": "Sanitation / waste", "Classroom infrastructure": "Classroom infrastructure", Furniture: "Furniture",
    "Hostel facilities": "Hostel facilities", "Library facilities": "Library facilities", Canteen: "Canteen",
    "Medical facilities": "Medical facilities", Other: "Other",
  },
  as: {
    "Water supply / plumbing": "পানী যোগান / নল-নৰ্দমা", Electrical: "বিদ্যুৎ", "Internet / network": "ইণ্টাৰনেট / নেটৱৰ্ক",
    "Sanitation / waste": "পৰিচ্ছন্নতা / আৱৰ্জনা", "Classroom infrastructure": "শ্ৰেণীকোঠাৰ আন্তঃগাঁথনি", Furniture: "আচবাব",
    "Hostel facilities": "হোষ্টেলৰ সুবিধা", "Library facilities": "গ্ৰন্থাগাৰৰ সুবিধা", Canteen: "কেণ্টিন",
    "Medical facilities": "চিকিৎসা সুবিধা", Other: "অন্যান্য",
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
