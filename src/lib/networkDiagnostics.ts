const isLoopbackHost = (host: string) =>
  host === "localhost" || host === "::1" || host === "[::1]" || /^127(?:\.\d{1,3}){3}$/.test(host);

const isPrivateIPv4 = (host: string) =>
  /^10(?:\.\d{1,3}){3}$/.test(host) ||
  /^192\.168(?:\.\d{1,3}){2}$/.test(host) ||
  /^172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}$/.test(host);

export function sharedDemoUsesLocalSupabase(pageHost: string, supabaseUrl: string | null, appEnv: string): boolean {
  if (!supabaseUrl || isLoopbackHost(pageHost)) return false;
  try {
    const endpoint = new URL(supabaseUrl);
    return isLoopbackHost(endpoint.hostname) ||
      (appEnv === "local" && endpoint.port === "54321" && isPrivateIPv4(endpoint.hostname));
  } catch {
    return false;
  }
}
