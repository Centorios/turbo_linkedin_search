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

export type JobSearchResponse = { items: JobListing[] };
