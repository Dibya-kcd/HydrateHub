import React, { useEffect, useMemo, useRef, useState } from "react";
import { serverSignIn, setApiSession } from "../../lib/authFetch";
import {
  deleteSalesmanFromSupabase,
  isServerProxyMode,
  pushDeletionRecordsToSupabase,
  pushSalesmanToSupabase,
  signInAdminSupabase,
  signOutSupabase,
  verifySalesmanPinSupabase,
} from "../../lib/supabase";
import type { AuthUser, Salesman, TabId, UserRole } from "../../types";
import { hashPin } from "../../utils/crypto";
import {
  isStaticDeployment,
  loadCachedAuthUser,
  loadCachedSalesmen,
  loadSalesmen,
  saveCachedAuthUser,
  saveSalesmen,
  setStorageUser,
} from "../../utils/storage";
import { cloud, cloudFetch } from "../ledgerHelpers";
import type { PullFromCloudOptions } from "../ledgerTypes";

// The built-in "admin" / "admin1234" passwords work only on a developer machine (vite dev server) or in a build made with
// VITE_ENABLE_DEMO_LOGIN=true. A production build never accepts them, so the sign-in cannot be bypassed from the browser.
const ALLOW_DEV_ADMIN_PASSWORDS: boolean =
  Boolean((import.meta as any).env?.DEV) || (import.meta as any).env?.VITE_ENABLE_DEMO_LOGIN === "true";

export interface UseAuthAndStaffParams {
  setTab: React.Dispatch<React.SetStateAction<TabId>>;
  notify: (message: string) => void;
  pullFromCloudRef: React.MutableRefObject<
    (opts?: PullFromCloudOptions) => Promise<{ success: boolean; message: string }>
  >;
}

const DEMO_SALESMEN_IDS = new Set(["sm_ramesh_kumar", "sm_suresh_patel"]);

export function useAuthAndStaff({
  setTab,
  notify,
  pullFromCloudRef,
}: UseAuthAndStaffParams) {
  const [salesmen, setSalesmen] = useState<Salesman[]>(() => {
    const cached = loadCachedSalesmen();
    if (cached && cached.length > 0)
      return (cached || []).filter(
        (s) =>
          !DEMO_SALESMEN_IDS.has(s.id) &&
          s.name !== "Ramesh Kumar" &&
          s.name !== "Suresh Patel",
      );
    return [];
  });

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    return loadCachedAuthUser();
  });
  const currentUserRef = useRef<AuthUser | null>(currentUser);
  currentUserRef.current = currentUser;

  const currentRole: UserRole | null = currentUser?.role || null;

  useEffect(() => {
    if (isServerProxyMode() && !currentUser?.id) return;
    loadSalesmen()
      .then((remote) => {
        if (remote && Array.isArray(remote) && remote.length > 0) {
          setSalesmen((prev) => {
            const map = new Map<string, Salesman>();
            prev.forEach((s) => map.set(s.id, s));
            remote.forEach((s) => map.set(s.id, s));
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {
        // ignore network errors
      });
  }, [currentUser?.id]);

  const activeSalesman: Salesman | null = useMemo(() => {
    if (currentUser?.role === "salesman") {
      return (
        salesmen.find(
          (s) => s.id === currentUser.id || s.phone === currentUser.phone,
        ) ||
        currentUser.salesman ||
        null
      );
    }
    return null;
  }, [currentUser, salesmen]);

  useEffect(() => {
    saveSalesmen(salesmen);
  }, [salesmen]);

  useEffect(() => {
    saveCachedAuthUser(currentUser);
  }, [currentUser]);

  const loginAdmin = async (
    identifier: string,
    pass: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanId = (identifier || "").trim();
    const cleanPass = (pass || "").trim();
    if (!cleanId || !cleanPass) {
      return { success: false, error: "Email or phone number and password are required" };
    }

    const isEmail = cleanId.includes("@");
    const digits = cleanId.replace(/\D/g, "");
    const phone10 = !isEmail && digits.length >= 10
      ? (digits.length > 10 && digits.startsWith("91") ? digits.slice(2, 12) : digits.slice(-10))
      : "";
    const isPhone = Boolean(phone10);

    const isAdminUsername = ["admin", "admin@mrwater.internal"].includes(cleanId.toLowerCase());

    // 1. First priority for admin username: Server Admin Sign-In (stays fast and secure)
    if (isAdminUsername) {
      const viaServer = await serverSignIn("admin", { password: cleanPass });
      if (viaServer?.ok) {
        setCurrentUser({
          role: "admin",
          email: "admin@mrwater.internal",
          name: "Administrator",
          id: "admin_server_primary",
        } as AuthUser);
        return { success: true };
      }

      // Fast offline fallback only if server is unreachable and not in server proxy mode
      if ((!viaServer || viaServer.unreachable) && !isServerProxyMode()) {
        const localAdminPassword = String(
          (import.meta as any).env?.VITE_LOCAL_ADMIN_PASSWORD || "",
        ).trim();
        if (
          (localAdminPassword.length >= 8 && cleanPass === localAdminPassword) ||
          (ALLOW_DEV_ADMIN_PASSWORDS && (cleanPass === "admin1234" || cleanPass === "admin"))
        ) {
          const adminUser: AuthUser = {
            role: "admin",
            email: "admin@mrwater.internal",
            name: "Administrator",
            id: "admin_local_primary",
          };
          setCurrentUser(adminUser);
          return { success: true };
        }
      }

      return {
        success: false,
        error: viaServer?.error || "Invalid administrator password.",
      };
    }

    // 2. Supabase Auth for registered email or phone accounts (disabled in server proxy mode)
    if (!isServerProxyMode() && (isEmail || isPhone)) {
      const res = await signInAdminSupabase(cleanId, cleanPass);
      if (res.success && res.user) {
        const adminUser: AuthUser = {
          role: "admin",
          email: res.user.email || (isEmail ? cleanId : ""),
          phone: res.user.phone || (isPhone ? phone10 : undefined),
          name:
            res.user.user_metadata?.full_name ||
            (isEmail ? cleanId.split("@")[0] : phone10) ||
            "Administrator",
          id: res.user.id,
        };
        setCurrentUser(adminUser);
        return { success: true };
      }
    }

    // 3. Server sign-in fallback for custom usernames or admin phone number
    const viaServer = await serverSignIn("admin", {
      password: cleanPass,
      ...(isPhone ? { phone: phone10 } : {}),
    });
    if (viaServer?.ok) {
      setCurrentUser({
        role: "admin",
        email: isEmail ? cleanId : "admin@mrwater.internal",
        ...(isPhone ? { phone: phone10 } : {}),
        name: "Administrator",
        id: "admin_server_primary",
      } as AuthUser);
      return { success: true };
    }

    // 4. Offline / first-setup fallback (never bypass an explicit server error or proxy mode)
    if ((!viaServer || viaServer.unreachable) && !isServerProxyMode()) {
      const localAdminPassword = String(
        (import.meta as any).env?.VITE_LOCAL_ADMIN_PASSWORD || "",
      ).trim();
      if (
        (localAdminPassword.length >= 8 && cleanPass === localAdminPassword) ||
        (ALLOW_DEV_ADMIN_PASSWORDS && (cleanPass === "admin1234" || cleanPass === "admin"))
      ) {
        const adminUser: AuthUser = {
          role: "admin",
          email: isEmail ? cleanId : "admin@mrwater.internal",
          ...(isPhone ? { phone: phone10 } : {}),
          name: "Administrator",
          id: "admin_local_primary",
        };
        setCurrentUser(adminUser);
        return { success: true };
      }
    }

    return {
      success: false,
      error: viaServer?.error || "Invalid administrator credentials.",
    };
  };

  const loginSalesman = async (
    phone: string,
    pin: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanPhone = (phone || "").trim();
    const cleanPin = (pin || "").trim();
    if (!cleanPhone || !cleanPin) {
      return { success: false, error: "Phone number and PIN are required." };
    }

    const viaServer = await serverSignIn("salesman", { phone: cleanPhone, pin: cleanPin });
    if (viaServer?.ok && viaServer.salesman) {
      const sm = viaServer.salesman as Salesman;
      setCurrentUser({ role: "salesman", salesman: sm, name: sm.name, phone: sm.phone, id: sm.id } as AuthUser);
      setTab("salesman");
      setSalesmen((prev) => (prev.some((x) => x.id === sm.id) ? prev : [...prev, sm]));
      return { success: true };
    }
    if (viaServer && !viaServer.ok && !viaServer.unreachable) {
      return { success: false, error: viaServer.error || "Incorrect phone number or PIN." };
    }
    if (isServerProxyMode()) {
      return {
        success: false,
        error: viaServer?.error || "Could not reach server to verify PIN.",
      };
    }
    // (server sign-in not configured or unreachable: the original on-device check below still applies)

    const computedHash = await hashPin(cleanPin);
    const digits = cleanPhone.replace(/\D/g, "");
    const last10 = digits.slice(-10);
    const localMatch = salesmen.find(
      (s) =>
        s.phone.trim() === cleanPhone ||
        (last10 && s.phone.replace(/\D/g, "").slice(-10) === last10),
    );

    if (localMatch) {
      if (localMatch.active === false) {
        return {
          success: false,
          error: "Account inactive — please contact administrator.",
        };
      }
      if (
        localMatch.pinHash &&
        (localMatch.pinHash.toLowerCase() === computedHash.toLowerCase() ||
          localMatch.pinHash.trim() === cleanPin)
      ) {
        const salesmanUser: AuthUser = {
          role: "salesman",
          salesman: localMatch,
          name: localMatch.name,
          phone: localMatch.phone,
          id: localMatch.id,
        };
        setCurrentUser(salesmanUser);
        setTab("salesman");
        return { success: true };
      }
    }

    const remoteRes = await verifySalesmanPinSupabase(cleanPhone, cleanPin);
    if (remoteRes.success && remoteRes.salesman) {
      if (remoteRes.salesman.active === false) {
        return {
          success: false,
          error: "Account inactive — please contact administrator.",
        };
      }
      const salesmanUser: AuthUser = {
        role: "salesman",
        salesman: remoteRes.salesman,
        name: remoteRes.salesman.name,
        phone: remoteRes.salesman.phone,
        id: remoteRes.salesman.id,
      };
      setCurrentUser(salesmanUser);
      setTab("salesman");
      setSalesmen((prev) => {
        if (!prev.some((s) => s.id === remoteRes.salesman!.id)) {
          return [...prev, remoteRes.salesman!];
        }
        return prev;
      });
      return { success: true };
    }

    return {
      success: false,
      error:
        remoteRes.error ||
        (localMatch
          ? "Invalid PIN. Please re-enter."
          : "No salesman registered with this phone number."),
    };
  };

  const logout = () => {
    if (!isServerProxyMode()) {
      signOutSupabase().catch(() => {});
    }
    setApiSession(null);
    setCurrentUser(null);
  };

  // Tell the save queue who is signed in (it only uploads that person's waiting items) and what they may write.
  useEffect(() => {
    setStorageUser(currentUser?.id || null, currentUser?.role || null);
  }, [currentUser?.id, currentUser?.role]);

  // Another device saved the same record first: say so, then fetch the newer copy instead of keeping a stale one.
  useEffect(() => {
    if (!currentUser || typeof window === "undefined") return;
    const onConflict = (e: Event) => {
      const msg = (e as CustomEvent)?.detail?.message;
      notify(`${msg || "A record was changed on another device."} Your change was not saved; please check and redo it.`);
      void pullFromCloudRef.current?.();
    };
    window.addEventListener("mrwater:sync-conflict", onConflict);
    return () => window.removeEventListener("mrwater:sync-conflict", onConflict);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // The server said the session is no longer valid (expired or revoked): sign out instead of failing silently.
  useEffect(() => {
    if (!currentUser || typeof window === "undefined") return;
    const loginTime = Date.now();
    const onExpired = () => {
      // Grace period: ignore auth-expired in the first 3 seconds after signing in
      // to allow background initial fetches to settle cleanly
      if (Date.now() - loginTime < 3000) return;
      notify("Your session has ended. Please sign in again.");
      logout();
    };
    window.addEventListener("mrwater:auth-expired", onExpired);
    return () => window.removeEventListener("mrwater:auth-expired", onExpired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role]);

  // Sign out after a period with no activity (a phone left unlocked, a shop PC left open).
  // Minutes come from VITE_IDLE_LOGOUT_MINUTES (default 30, 0 turns it off).
  useEffect(() => {
    if (!currentUser || typeof window === "undefined") return;
    const raw = Number((import.meta as any).env?.VITE_IDLE_LOGOUT_MINUTES);
    const minutes = Number.isFinite(raw) && (import.meta as any).env?.VITE_IDLE_LOGOUT_MINUTES !== undefined ? raw : 30;
    if (minutes <= 0) return;
    let last = Date.now();
    const bump = () => {
      last = Date.now();
    };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - last >= minutes * 60_000) {
        notify(`Signed out after ${minutes} minutes of inactivity. Please sign in again.`);
        logout();
      }
    }, 30_000);
    (timer as any)?.unref?.();
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role]);

  const addSalesman = async (
    data: {
      name: string;
      phone: string;
      defaultVehicle?: string;
      active?: boolean;
    },
    pin: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanName = data.name.trim();
    const cleanPhone = data.phone.trim();
    const cleanPin = pin.trim();

    if (!cleanName)
      return { success: false, error: "Salesman name is required." };
    if (!cleanPhone)
      return { success: false, error: "Phone number is required." };
    if (cleanPin.length < 4 || cleanPin.length > 6 || !/^\d+$/.test(cleanPin)) {
      return { success: false, error: "PIN must be 4 to 6 digits." };
    }

    if (salesmen.some((s) => s.phone.trim() === cleanPhone)) {
      return {
        success: false,
        error: "A salesman with this phone number already exists.",
      };
    }

    // With a server, the PIN goes to the server (owner only) and is hashed there with its own salt; the phone never
    // keeps a hash. Only the static, server-less deployment still hashes in the app.
    const pinHash = isStaticDeployment() ? await hashPin(cleanPin) : "";
    const newSalesman: Salesman = {
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : "sm_" +
          Date.now().toString(36) +
          Math.random().toString(36).slice(2, 6),
      name: cleanName,
      phone: cleanPhone,
      pinHash,
      active: data.active !== undefined ? Boolean(data.active) : true,
      defaultVehicle: data.defaultVehicle || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSalesmen((prev) => [...prev, newSalesman]);
    if (isStaticDeployment()) {
      cloud("pushSalesmanToSupabase", pushSalesmanToSupabase(newSalesman));
    }
    cloudFetch("/api/salesmen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newSalesman, pinHash: "", pin: cleanPin }),
    });

    return { success: true };
  };

  const updateSalesman = async (
    id: string,
    data: Partial<Salesman>,
    newPin?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    let pinHashToUse = data.pinHash;
    let plainNewPin = "";
    if (newPin && newPin.trim()) {
      const cleanPin = newPin.trim();
      if (
        cleanPin.length < 4 ||
        cleanPin.length > 6 ||
        !/^\d+$/.test(cleanPin)
      ) {
        return { success: false, error: "New PIN must be 4 to 6 digits." };
      }
      plainNewPin = cleanPin;
      pinHashToUse = isStaticDeployment() ? await hashPin(cleanPin) : undefined;
    }

    // Build the updated record first; the cloud push below needs it right away, so it must not
    // depend on a state updater having run.
    const currentSalesman = salesmen.find((s) => s.id === id);
    const updatedTarget: Salesman | null = currentSalesman
      ? {
          ...currentSalesman,
          ...data,
          ...(pinHashToUse ? { pinHash: pinHashToUse } : {}),
          updatedAt: new Date().toISOString(),
        }
      : null;
    if (updatedTarget) {
      setSalesmen((prev) => prev.map((s) => (s.id === id ? updatedTarget : s)));
    }

    if (updatedTarget) {
      if (isStaticDeployment()) {
        cloud("pushSalesmanToSupabase", pushSalesmanToSupabase(updatedTarget));
      }
      cloudFetch(`/api/salesmen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...updatedTarget, pinHash: "", ...(plainNewPin ? { pin: plainNewPin } : {}) }),
      });
    }

    return { success: true };
  };

  const toggleSalesmanActive = async (id: string): Promise<void> => {
    const currentSalesman = salesmen.find((s) => s.id === id);
    const updatedTarget: Salesman | null = currentSalesman
      ? {
          ...currentSalesman,
          active: !currentSalesman.active,
          updatedAt: new Date().toISOString(),
        }
      : null;
    if (updatedTarget) {
      setSalesmen((prev) => prev.map((s) => (s.id === id ? updatedTarget : s)));
    }

    if (updatedTarget) {
      if (isStaticDeployment()) {
        cloud("pushSalesmanToSupabase", pushSalesmanToSupabase(updatedTarget));
      }
      cloudFetch(`/api/salesmen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...updatedTarget, pinHash: "" }),
      });
    }
  };

  const deleteSalesman = async (id: string): Promise<void> => {
    setSalesmen((prev) => prev.filter((s) => s.id !== id));
    if (isServerProxyMode()) {
      cloudFetch(`/api/salesmen/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ by: currentUserRef.current?.name || "Admin" }),
      });
      return;
    }
    pushDeletionRecordsToSupabase([
      { kind: "salesman", id, deletedAt: new Date().toISOString(), by: currentUserRef.current?.name || "Admin" },
    ]).catch(() => {});
    cloud("deleteSalesmanFromSupabase", deleteSalesmanFromSupabase(id));
    cloudFetch(`/api/salesmen/${id}`, { method: "DELETE" });
  };

  return {
    salesmen,
    setSalesmen,
    currentUser,
    setCurrentUser,
    currentUserRef,
    currentRole,
    activeSalesman,
    loginAdmin,
    loginSalesman,
    logout,
    addSalesman,
    updateSalesman,
    toggleSalesmanActive,
    deleteSalesman,
  };
}
