import { z } from "zod";
import { priorities, statuses } from "@/lib/types";
import { campusDepartments } from "@/lib/departments";

const categories = [
    "Infrastructure", "Utilities", "Safety and Security", "Transportation", 
    "Environmental", "Administrative", "Student Life", "Faculty Support", 
    "Events and Activities", "Technology and IT", "Health and Wellness", "Other"
] as const;

export const reportAnalysisSchema = z.object({
  detectedLanguage: z.enum(["English", "Assamese", "Romanised Assamese", "Mixed"]),
  category: z.enum(categories),
  priority: z.enum(priorities),
  priorityExplanation: z.string().trim().min(3).max(500),
  titleEn: z.string().trim().min(1).max(120),
  titleAs: z.string().trim().min(1).max(160),
  summaryEn: z.string().trim().min(3).max(500),
  summaryAs: z.string().trim().min(3).max(500),
  department: z.enum(campusDepartments),
  imageDescription: z.string().max(500).optional(),
  confidence: z.number().min(0).max(1),
  sensitive: z.boolean(),
});

export const imageReportDraftSchema = z.object({
  description: z.string().trim().min(10).max(5000),
  category: z.enum(categories),
  priority: z.enum(priorities),
  priorityExplanation: z.string().trim().min(3).max(500),
});

export const updateReportSchema = z.object({
  status: z.enum(statuses).optional(),
  category: z.enum(categories).optional(),
  confirmedPriority: z.enum(priorities).nullable().optional(),
  assignedTo: z.string().max(120).nullable().optional(),
  assignedDepartment: z.string().max(120).nullable().optional(),
  message: z.string().max(1000).optional(),
}).refine((body) => Object.values(body).some((value) => value !== undefined), "At least one field is required");

export const reportInputSchema = z.object({
  originalText: z.string().trim().min(10).max(5000),
  language: z.enum(["English", "Assamese", "Romanised Assamese", "Mixed"]).optional().default("Mixed"),
  building: z.string().trim().min(2).max(120),
  area: z.string().trim().max(120).default(""),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  accuracyMeters: z.number().finite().min(0).max(25_000_000).optional(),
  category: z.enum(categories).optional(),
  publicOptOut: z.boolean().optional().default(false),
}).refine((input) => (input.latitude === undefined) === (input.longitude === undefined), {
  message: "Provide both coordinates or omit both.",
  path: ["latitude"],
}).refine((input) => input.accuracyMeters === undefined || input.latitude !== undefined, {
  message: "Location accuracy requires a location pin.",
  path: ["accuracyMeters"],
});

export const clusterInputSchema = z.object({
  title: z.string().trim().min(3).max(160),
  reportIds: z.array(z.string().uuid()).min(2).max(50),
  assignedTo: z.string().max(120).nullable().optional(),
});
