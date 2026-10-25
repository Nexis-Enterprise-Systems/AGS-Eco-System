import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/types";

// Authenticator Assurance Level, from Supabase's built-in MFA system.
// currentLevel is what the active session actually satisfies right
// now; nextLevel is the highest level available to it (aal2 once a
// TOTP factor is enrolled and verified at least once).
export interface AalState {
  currentLevel: "aal1" | "aal2" | null;
  nextLevel: "aal1" | "aal2" | null;
}

// 2FA is mandatory for every account (not opt-in), because the system
// holds sensitive client data. Three states matter, in order:
//   1. hasVerifiedFactor === false -> account has never completed 2FA
//      enrollment. Sent to /mfa-setup, which cannot be dismissed —
//      there is no "skip" path, by design.
//   2. hasVerifiedFactor === true but aal.currentLevel !== 'aal2' ->
//      enrolled previously, but this particular session hasn't done
//      the code challenge yet. Sent to /mfa-challenge.
//   3. aal.currentLevel === 'aal2' -> fully authenticated, into the app.
// This client-side gate is a UX convenience only — the real
// enforcement is in Postgres: supabase/migrations/0002_mandatory_mfa.sql
// requires aal2 in Row Level Security itself, so even a request that
// bypasses this app entirely (e.g. hitting Supabase's API directly
// with a valid password-only session) is refused at the database.
interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  aal: AalState | null;
  hasVerifiedFactor: boolean | null;
  loading: boolean;
  needsMfaSetup: boolean;
  needsMfaChallenge: boolean;
  mfaSatisfied: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshMfaState: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [aal, setAal] = useState<AalState | null>(null);
  const [hasVerifiedFactor, setHasVerifiedFactor] = useState<boolean | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [mfaLoading, setMfaLoading] = useState(true);

  const refreshMfaState = useCallback(async () => {
    setMfaLoading(true);
    const [{ data: aalData, error: aalErr }, { data: factorData, error: factorErr }] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);

    if (aalErr) {
      // eslint-disable-next-line no-console
      console.error("Failed to read MFA assurance level:", aalErr.message);
      setAal(null);
    } else {
      setAal({ currentLevel: aalData.currentLevel, nextLevel: aalData.nextLevel });
    }

    if (factorErr) {
      // eslint-disable-next-line no-console
      console.error("Failed to list MFA factors:", factorErr.message);
      setHasVerifiedFactor(null);
    } else {
      setHasVerifiedFactor((factorData?.totp ?? []).some((f) => f.status === "verified"));
    }

    setMfaLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (!data.session) {
        setProfileLoading(false);
        setMfaLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        setProfile(null);
        setAal(null);
        setHasVerifiedFactor(null);
        setProfileLoading(false);
        setMfaLoading(false);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    let active = true;
    setProfileLoading(true);

    supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          // eslint-disable-next-line no-console
          console.error("Failed to load profile:", error.message);
        }
        setProfile((data as Profile) ?? null);
        setProfileLoading(false);
      });

    refreshMfaState();

    return () => {
      active = false;
    };
  }, [session?.user?.id, refreshMfaState]);

  // Re-fetch the signed-in person's own profile row — used after a
  // self-edit on the My Profile page (name/phone/DOB/avatar) so the
  // Sidebar and anywhere else reading `profile` picks up the change
  // without a full page reload.
  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    const { data, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to refresh profile:", error.message);
      return;
    }
    setProfile((data as Profile) ?? null);
  }, [session?.user]);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) {
      // The "not invited" rejection happens inside the handle_new_user
      // Postgres trigger (see supabase/migrations/0003_self_signup.sql)
      // — Supabase Auth typically wraps a trigger failure in a generic
      // "Database error saving new user" message rather than passing
      // our custom text through, so show one clear message either way
      // instead of surfacing raw Postgres wording.
      const looksLikeTriggerFailure = /database error|unexpected_failure/i.test(error.message);
      return {
        error: looksLikeTriggerFailure
          ? "That email hasn't been added by your administrator yet. Double-check you're using your exact work email, or ask them to add it."
          : error.message,
        needsEmailConfirmation: false,
      };
    }

    return { error: null, needsEmailConfirmation: !!data.user && !data.session };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setAal(null);
    setHasVerifiedFactor(null);
  }

  const loading = profileLoading || mfaLoading;
  const needsMfaSetup = hasVerifiedFactor === false;
  const needsMfaChallenge = hasVerifiedFactor === true && aal?.currentLevel !== "aal2";
  const mfaSatisfied = hasVerifiedFactor === true && aal?.currentLevel === "aal2";

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        aal,
        hasVerifiedFactor,
        loading,
        needsMfaSetup,
        needsMfaChallenge,
        mfaSatisfied,
        signIn,
        signUp,
        signOut,
        refreshMfaState,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
