import type { StructuredCv } from "./cv";
import type { CertificateMergeReport } from "./profile-certificate";

export interface CvSource {
  id: string;
  originalFilename: string;
  fileSizeBytes: number;
  pageCount: number;
  createdAt: string;
}

export interface ResumeVersion {
  id: string;
  /** null for versions of a generated CV (no imported PDF). */
  sourceId: string | null;
  parentResumeId: string | null;
  createdAt: string;
  data: StructuredCv;
  certificateMergeReport?: CertificateMergeReport;
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
