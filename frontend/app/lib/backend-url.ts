function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "[::1]" || /^127(?:\.\d{1,3}){3}$/.test(hostname);
}

export function getBackendUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.trim().replace(/\/$/, "") ?? "";
  if (!configuredUrl || typeof window === "undefined") return configuredUrl;

  // A deployed site must never send API calls (and session tokens) to the
  // visitor's computer when a local development URL was copied into Vercel.
  const backend = new URL(configuredUrl, window.location.origin);
  if (isLoopback(backend.hostname) && !isLoopback(window.location.hostname)) return "";
  return configuredUrl;
}
