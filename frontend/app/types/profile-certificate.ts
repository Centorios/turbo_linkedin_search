import type { Certification, Language } from "./cv";

export interface CertificateMergeReport {
  addedIds: string[];
  duplicateIds: string[];
  pendingIds: string[];
}

export interface ProfileCertificate {
  id: string;
  originalFilename: string;
  mimeType: "application/pdf" | "image/jpeg" | "image/png";
  fileSizeBytes: number;
  status: "pending_review" | "ready";
  certification: Certification;
  language: Language | null;
  createdAt: string;
  duplicate: boolean;
}

export interface CertificatePage {
  items: ProfileCertificate[];
  offset: number;
  limit: number;
  hasMore: boolean;
}
