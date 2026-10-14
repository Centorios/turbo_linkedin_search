import { JobsApiError, requestJobs } from "./jobs-client";
import type { MatchRequest, MatchResult } from "../types/match";

export async function getSavedMatch(
  userId: string,
  searchId: string,
  resumeId: string,
  signal: AbortSignal,
): Promise<MatchResult | null> {
  try {
    return await requestJobs(
      userId,
      `/api/jobs/match/${encodeURIComponent(searchId)}?resumeId=${encodeURIComponent(resumeId)}`,
      { method: "GET", signal },
    );
  } catch (error) {
    if (error instanceof JobsApiError && error.status === 404) return null;
    throw error;
  }
}

export function requestMatch(
  userId: string,
  request: MatchRequest,
  signal: AbortSignal,
): Promise<MatchResult> {
  return requestJobs(userId, "/api/jobs/match", {
    method: "POST",
    body: JSON.stringify(request),
    signal,
  });
}
