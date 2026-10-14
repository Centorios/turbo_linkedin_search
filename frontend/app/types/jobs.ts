export type JobSearchProfile = {
  resumeId: string;
  suggestedKeywords: string;
  suggestedLocation: string;
  skills: string[];
};

export type JobListing = {
  id: string;
  title: string;
  company: string;
  location: string;
  snippet: string;
  url: string;
  source: string;
  updatedAt: string | null;
};

export type JobSourceName = "jooble" | "linkedin";
export type JobSourceRunStatus = "pending" | "running" | "succeeded" | "failed" | "timed_out";
export type JobSearchStatus = "in_progress" | "complete" | "incomplete";

export type JobSourceState = {
  source: JobSourceName;
  status: JobSourceRunStatus;
  offersCount: number;
  error?: string | null;
};

export type JobSearchResponse = {
  items: JobListing[];
  searchId: string | null;
  status?: JobSearchStatus;
  sources?: JobSourceState[];
};
