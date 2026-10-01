import type { StructuredCv } from "./cv";

export type ResumeSummary = { id: string; createdAt: string; fullName: string; summary: string };
export type ResumeHistoryPage = { items: ResumeSummary[]; offset: number; limit: number; hasMore: boolean };
export type ResumeDetail = { id: string; createdAt: string; data: StructuredCv };
