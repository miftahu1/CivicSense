import { z } from "zod";
import { categories, priorities, statuses } from "@/lib/types";

export const reportAnalysisSchema = z.object({
  detectedLanguage: z.enum(["English", "Assamese", "Romanised Assamese", "Mixed"]),
  category: z.enum(categories),
  priority: z.enum(priorities),
  priorityExplanation: z.string().trim().min(3).max(500),
  titleEn: z.string().trim().min(1).max(120),
  titleAs: z.string().trim().min(1).max(160),
  summaryEn: z.string().trim().min(3).max(500),
  summaryAs: z.string().trim().min(3).max(500),
  department: z.string().min(2).max(100),
  imageDescription: z.string().max(500),
  confidence: z.number().min(0).max(1),
  sensitive: z.boolean(),
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
  language: z.enum(["English", "Assamese", "Romanised Assamese", "Mixed"]),
  building: z.string().trim().min(2).max(120),
  area: z.string().trim().max(120).default(""),
  category: z.enum(categories).optional(),
});

export const clusterInputSchema = z.object({
  title: z.string().trim().min(3).max(160),
  reportIds: z.array(z.string().uuid()).min(2).max(50),
  assignedTo: z.string().max(120).nullable().optional(),
});
