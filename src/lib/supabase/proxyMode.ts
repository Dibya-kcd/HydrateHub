/**
 * Feature switch for routing all browser Supabase calls through the Express /api/* server proxy.
 * Default is OFF ("false") so the existing direct Supabase path stays intact until verified on staging.
 */

let testOverride: boolean | null = null;

export function setServerProxyModeForTest(enabled: boolean | null): void {
  testOverride = enabled;
}

export function isServerProxyMode(): boolean {
  if (testOverride !== null) return testOverride;
  try {
    const viteFlag = (import.meta as any)?.env?.VITE_PROXY_SUPABASE_VIA_SERVER;
    if (viteFlag !== undefined && viteFlag !== "") {
      return String(viteFlag).trim().toLowerCase() === "true";
    }
  } catch {
    // ignore
  }
  try {
    const nodeFlag = (globalThis as any).process?.env?.VITE_PROXY_SUPABASE_VIA_SERVER;
    if (nodeFlag !== undefined && nodeFlag !== "") {
      return String(nodeFlag).trim().toLowerCase() === "true";
    }
  } catch {
    // ignore
  }
  return false;
}
