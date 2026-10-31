export const categories = [
  "Water supply / plumbing",
  "Electrical",
  "Internet / network",
  "Sanitation / waste",
  "Classroom infrastructure",
  "Furniture",
  "Hostel facilities",
  "Library facilities",
  "Canteen",
  "Medical facilities",
  "Other",
] as const;

export const priorities = ["Low", "Medium", "High", "Urgent"] as const;
export const statuses = ["Under review", "Investigating", "In progress", "Resolved"] as const;
export type Category = (typeof categories)[number];
export type Priority = (typeof priorities)[number];
export type ReportStatus = (typeof statuses)[number];
export type UserRole = "student" | "staff" | "admin";
export type Language = "English" | "Assamese" | "Romanised Assamese" | "Mixed";

export type Report = {
  id: string;
  ticketNumber: string;
  reporterId: string;
  reporterName: string;
  originalText: string;
  originalLanguage: Language;
  summaryEn: string;
  summaryAs: string;
  titleEn: string;
  titleAs: string;
  category: Category;
  suggestedPriority: Priority;
  confirmedPriority: Priority | null;
  priorityExplanation: string;
  building: string;
  area: string;
  status: ReportStatus;
  clusterId: string | null;
  assignedTo: string | null;
  assignedDepartment?: string | null;
  department: string;
  sensitive: boolean;
  analysisStatus: "pending" | "complete" | "failed";
  analysisConfidence?: number | null;
  analysisError?: string | null;
  isSynthetic?: boolean;
  createdAt: string;
  updatedAt: string;
  imageUrl?: string;
  imageCaption?: string;
  events: ReportEvent[];
};

export type ReportEvent = {
  id: string;
  actor: string;
  oldStatus: ReportStatus | null;
  newStatus: ReportStatus | null;
  message: string;
  createdAt: string;
};

export type IssueCluster = {
  id: string;
  title: string;
  category: Category;
  location: string;
  status: ReportStatus;
  assignedTo: string | null;
  reportIds: string[];
  createdAt: string;
};

export type SimilarReport = {
  report: Report;
  score: number;
  explanation: string;
  explanationAs: string;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  preferredLanguage: "en" | "as";
};
