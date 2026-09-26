"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { getBasicProfile, saveBasicProfile } from "../lib/basic-profile-client";
import { createSupabaseBrowserClient } from "../lib/supabase";
import type { BasicProfile } from "../types/profile";

export type ProfileStatus = "idle" | "loading" | "missing" | "saved" | "saving" | "error" | "deferred";

type SessionContextValue = {
  session: Session | null;
  isLoading: boolean;
  profile: BasicProfile | null;
  profileStatus: ProfileStatus;
  profileError: string | null;
  saveError: string | null;
  refreshProfile: () => Promise<void>;
  saveProfile: (profile: BasicProfile) => Promise<void>;
  deferProfile: () => void;
};

const SessionContext = createContext<SessionContextValue>({
  session: null,
  isLoading: true,
  profile: null,
  profileStatus: "idle",
  profileError: null,
  saveError: null,
  refreshProfile: async () => {},
  saveProfile: async () => {},
  deferProfile: () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<BasicProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("idle");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const currentUserId = useRef<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      currentUserId.current = data.session?.user.id ?? null;
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const nextUserId = nextSession?.user.id ?? null;
      const userChanged = currentUserId.current !== nextUserId;
      currentUserId.current = nextUserId;
      setSession(nextSession);
      if (userChanged) {
        setProfile(null);
        setProfileStatus(nextSession ? "loading" : "idle");
        setProfileError(null);
        setSaveError(null);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function refreshProfile() {
    if (!session) return;
    setProfileStatus("loading");
    setProfileError(null);
    try {
      const currentProfile = await getBasicProfile();
      setProfile(currentProfile);
      setProfileStatus(currentProfile?.fullName.trim() ? "saved" : "missing");
    } catch (error) {
      setProfile(null);
      setProfileStatus("error");
      setProfileError(error instanceof Error ? error.message : "No se pudo cargar el perfil");
    }
  }

  async function handleSaveProfile(nextProfile: BasicProfile) {
    setProfileStatus("saving");
    setSaveError(null);
    try {
      const savedProfile = await saveBasicProfile(nextProfile);
      setProfile(savedProfile);
      setProfileStatus("saved");
    } catch (error) {
      setProfileStatus("missing");
      setSaveError(error instanceof Error ? error.message : "No se pudo guardar el perfil");
    }
  }

  function deferProfile() {
    setProfileStatus("deferred");
    setSaveError(null);
  }

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setProfileStatus("idle");
      setProfileError(null);
      return;
    }

    let active = true;
    setProfile(null);
    setProfileStatus("loading");
    setProfileError(null);
    void getBasicProfile()
      .then((currentProfile) => {
        if (!active) return;
        setProfile(currentProfile);
        setProfileStatus(currentProfile?.fullName.trim() ? "saved" : "missing");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setProfileStatus("error");
        setProfileError(error instanceof Error ? error.message : "No se pudo cargar el perfil");
      });

    return () => {
      active = false;
    };
  }, [session?.user.id]);

  useEffect(() => {
    if (!isLoading && !session && pathname.startsWith("/generate")) {
      router.replace("/auth?reason=session-expired");
    }
  }, [isLoading, pathname, router, session]);

  return (
    <SessionContext.Provider
      value={{
        session,
        isLoading,
        profile,
        profileStatus,
        profileError,
        saveError,
        refreshProfile,
        saveProfile: handleSaveProfile,
        deferProfile,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
