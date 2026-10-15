import type { StructuredCv } from "./cv";

export interface CvSource {
  id: string;
  originalFilename: string;
  fileSizeBytes: number;
  pageCount: number;
  createdAt: string;
}

export interface ResumeVersion {
  id: string;
  sourceId: string;
  parentResumeId: string | null;
  createdAt: string;
  data: StructuredCv;
}

export interface CvImportResponse {
  source: CvSource;
  resume: ResumeVersion;
}

export type ChangedSection =
  | "personalInfo"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "languages"
  | "certifications";

export type EditResponse =
  | { status: "needs_input"; questions: string[] }
  | {
      status: "ready";
      proposedCv: StructuredCv;
      changedSections: ChangedSection[];
      changeSummary: string;
    };
