import { getSupabaseClient, isServerProxyMode, proxyFetch } from "./client";
import { setApiSession } from "../authFetch";
import { hashPin } from "../../utils/crypto";
import type { Salesman } from "../../types";

/* =========================================================================
 * SALESMEN & AUTHENTICATION METHODS (Supabase Auth & public.salesmen)
 * ========================================================================= */

export async function fetchSalesmenFromSupabase(): Promise<Salesman[]> {
  if (isServerProxyMode()) {
    const res = await proxyFetch<{ success?: boolean; data?: any[] }>("/api/salesmen", {
      method: "GET",
    });
    if (!res.ok || !Array.isArray(res.data?.data)) return [];
    return res.data.data.map((s: any) => ({
      id: String(s.id),
      name: s.name || "",
      phone: s.phone || "",
      pinHash: "",
      hasPin: Boolean(s.hasPin),
      active: s.active !== undefined ? Boolean(s.active) : true,
      defaultVehicle: s.default_vehicle || s.defaultVehicle || "",
      createdAt: s.created_at || s.createdAt || new Date().toISOString(),
      updatedAt: s.updated_at || s.updatedAt || new Date().toISOString(),
    }));
  }

  const client = getSupabaseClient();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from("salesmen")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.warn("fetchSalesmenFromSupabase error:", error.message);
      return [];
    }

    return (data || []).map((s: any) => ({
      id: String(s.id),
      name: s.name || "",
      phone: s.phone || "",
      pinHash: s.pin_hash || s.pinHash || "",
      active: s.active !== undefined ? Boolean(s.active) : true,
      defaultVehicle: s.default_vehicle || s.defaultVehicle || "",
      createdAt: s.created_at || s.createdAt || new Date().toISOString(),
      updatedAt: s.updated_at || s.updatedAt || new Date().toISOString(),
    }));
  } catch (e) {
    console.warn("fetchSalesmenFromSupabase exception:", e);
    return [];
  }
}

export async function pushSalesmanToSupabase(
  s: Salesman,
): Promise<{ success: boolean; error?: string }> {
  if (isServerProxyMode()) {
    const res = await proxyFetch("/api/salesmen", {
      method: "POST",
      body: JSON.stringify({ ...s, pinHash: "" }),
    });
    return res.ok ? { success: true } : { success: false, error: res.error || "Failed to save salesman" };
  }

  const client = getSupabaseClient();
  if (!client)
    return { success: false, error: "Supabase client is not configured" };
  try {
    const payload = {
      id: s.id,
      name: s.name.trim(),
      phone: s.phone.trim(),
      // An empty hash must never overwrite the stored PIN.
      ...(s.pinHash ? { pin_hash: s.pinHash } : {}),
      active: s.active !== undefined ? Boolean(s.active) : true,
      default_vehicle: s.defaultVehicle || "",
      updated_at: new Date().toISOString(),
    };
    const { error } = await client
      .from("salesmen")
      .upsert(payload, { onConflict: "id" });
    if (error) {
      console.warn("Failed to push salesman to Supabase:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    console.warn("Failed to push salesman to Supabase:", e);
    return { success: false, error: e?.message || "Network error" };
  }
}

export async function deleteSalesmanFromSupabase(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (isServerProxyMode()) {
    const res = await proxyFetch(`/api/salesmen/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return res.ok ? { success: true } : { success: false, error: res.error || "Failed to delete salesman" };
  }

  const client = getSupabaseClient();
  if (!client)
    return { success: false, error: "Supabase client is not configured" };
  try {
    const { error } = await client.from("salesmen").delete().eq("id", id);
    if (error) {
      console.warn("Failed to delete salesman in Supabase:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    console.warn("Failed to delete salesman in Supabase:", e);
    return { success: false, error: e?.message || "Network error" };
  }
}

export async function verifySalesmanPinSupabase(
  phone: string,
  pin: string,
): Promise<{ success: boolean; salesman?: Salesman; error?: string }> {
  const cleanPhone = (phone || "").trim();
  const cleanPin = (pin || "").trim();

  if (!cleanPhone || !cleanPin) {
    return { success: false, error: "Phone and PIN are required" };
  }

  // 1. Primary: Server endpoint (handles scrypt with pepper, salt, hash upgrade, rate limiting)
  try {
    const resp = await fetch("/api/auth/salesman-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: cleanPhone, pin: cleanPin }),
    });
    const result = await resp.json().catch(() => null);
    if (resp.ok && result?.success && result?.salesman) {
      if (result.token) {
        setApiSession(result.token, result.expiresAt);
      }
      return { success: true, salesman: result.salesman };
    }
    if (result && !result.success && result.error) {
      return { success: false, error: result.error };
    }
    if (isServerProxyMode()) {
      return {
        success: false,
        error: "Could not reach the server to check your PIN. Please try again.",
      };
    }
  } catch {
    if (isServerProxyMode()) {
      return {
        success: false,
        error: "Could not reach the server to check your PIN. Check your internet connection and try again.",
      };
    }
    // server unreachable: proceed to direct check
  }

  // 2. Direct Supabase query (for static deployments or offline fallbacks)
  const client = getSupabaseClient();
  if (client) {
    try {
      const digits = cleanPhone.replace(/\D/g, "");
      const last10 = digits.slice(-10);
      const candidates = Array.from(new Set([cleanPhone, digits, last10, `+91${last10}`, `0${last10}`].filter(Boolean)));

      const { data, error } = await client
        .from("salesmen")
        .select("*")
        .in("phone", candidates)
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        if (data.active === false) {
          return {
            success: false,
            error: "This salesman account is deactivated. Contact admin.",
          };
        }
        const storedHash = data.pin_hash || data.pinHash || "";
        if (!storedHash) {
          return { success: false, error: "No PIN has been configured for this salesman yet." };
        }

        const computedHash = await hashPin(cleanPin);
        const legacyMatches = storedHash.toLowerCase() === computedHash.toLowerCase();
        const plainMatches = storedHash.trim() === cleanPin;

        if (legacyMatches || plainMatches) {
          return {
            success: true,
            salesman: {
              id: String(data.id),
              name: data.name || "",
              phone: data.phone || "",
              pinHash: storedHash,
              active: Boolean(data.active),
              defaultVehicle: data.default_vehicle || data.defaultVehicle || "",
              createdAt: data.created_at || "",
              updatedAt: data.updated_at || "",
            },
          };
        }
      }
    } catch (e) {
      console.warn("Direct Supabase verify exception, falling back to backend API:", e);
    }
  }

  // 3. Fallback to /api/salesmen/verify-pin
  try {
    const resp = await fetch("/api/salesmen/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: cleanPhone, pin: cleanPin }),
    });
    const result = await resp.json().catch(() => null);
    if (resp.ok && result?.success && result?.salesman) {
      return { success: true, salesman: result.salesman };
    }
    if (result?.error) return { success: false, error: result.error };
    // No JSON answer (for example GitHub Pages replying 404 because there is no /api there): the PIN was never
    // checked by the server, so do not claim it is wrong.
    return {
      success: false,
      error: result
        ? "Incorrect PIN. Please try again."
        : "Could not reach the server to check your PIN. Check your internet connection and try again in a minute. If it keeps happening, ask the admin to check the app's server address.",
    };
  } catch {
    return {
      success: false,
      error: "Could not reach the server to check your PIN. Check your internet connection and try again in a minute.",
    };
  }
}

// Supabase Auth for Admin Login (Email or Phone Number)
export async function signInAdminSupabase(
  identifier: string,
  pass: string,
): Promise<{ success: boolean; user?: any; error?: string }> {
  const trimmed = identifier.trim();
  const isEmail = trimmed.includes("@");
  const digits = trimmed.replace(/\D/g, "");
  const isPhone = !isEmail && digits.length >= 10;

  if (!isEmail && !isPhone) {
    return { success: false, error: "Not a valid email or phone number" };
  }

  if (isServerProxyMode()) {
    return {
      success: false,
      error: "Direct Supabase Auth is disabled when server-proxy mode is active.",
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: "Supabase client is not configured" };
  }

  try {
    const e164Phone = trimmed.startsWith("+")
      ? `+${digits}`
      : digits.length === 10
        ? `+91${digits}`
        : `+${digits}`;

    const credentials = isEmail
      ? { email: trimmed, password: pass }
      : { phone: e164Phone, password: pass };

    const authPromise = client.auth.signInWithPassword(credentials);
    const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) =>
      setTimeout(() => reject(new Error("Supabase authentication timed out")), 3500)
    );

    const { data, error } = (await Promise.race([authPromise, timeoutPromise])) as any;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, user: data?.user };
  } catch (e: any) {
    return { success: false, error: e?.message || "Login failed" };
  }
}

export async function signOutSupabase(): Promise<void> {
  if (isServerProxyMode()) return;
  const client = getSupabaseClient();
  if (client) {
    try {
      await client.auth.signOut();
    } catch (e) {
      console.warn("Supabase signOut notice:", e);
    }
  }
}

export async function getCurrentSupabaseSession(): Promise<any | null> {
  if (isServerProxyMode()) return null;
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data } = await client.auth.getSession();
    return data?.session || null;
  } catch {
    return null;
  }
}
