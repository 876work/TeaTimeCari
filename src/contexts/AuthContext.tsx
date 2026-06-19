import React from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

export type UserRole = 'business' | 'creator' | 'admin';
export type ProfileStatus = 'active' | 'pending' | 'suspended' | 'deleted';

export type AuthProfile = {
  id: string;
  role: UserRole | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  country_code: string | null;
  city: string | null;
  status: ProfileStatus | null;
  created_at: string | null;
  updated_at: string | null;
};

type AuthContextValue = {
  user: User | null;
  profile: AuthProfile | null;
  role: UserRole | null;
  isLoading: boolean;
  profileError: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isBusiness: boolean;
  isCreator: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

const allowedRoles = new Set<UserRole>(['business', 'creator', 'admin']);

const normalizeProfile = (profile: AuthProfile | null): AuthProfile | null => {
  if (!profile) return null;
  return {
    ...profile,
    role: profile.role && allowedRoles.has(profile.role) ? profile.role : null,
    status: profile.status ?? 'pending',
  };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [profile, setProfile] = React.useState<AuthProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [profileError, setProfileError] = React.useState<string | null>(null);

  const loadProfile = React.useCallback(async (nextUser: User | null) => {
    if (!nextUser) {
      setProfile(null);
      setProfileError(null);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, full_name, email, avatar_url, country_code, city, status, created_at, updated_at')
      .eq('id', nextUser.id)
      .maybeSingle();

    if (error) {
      setProfile(null);
      setProfileError('We could not load your account setup. Please contact support.');
      return;
    }

    if (!data) {
      setProfile(null);
      setProfileError('Your account exists, but setup is incomplete. Please contact support.');
      return;
    }

    setProfile(normalizeProfile(data as AuthProfile));
    setProfileError(null);
  }, []);

  const refreshProfile = React.useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase.auth.getUser();
    setUser(data.user ?? null);
    await loadProfile(data.user ?? null);
    setIsLoading(false);
  }, [loadProfile]);

  React.useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(data.user ?? null);
      await loadProfile(data.user ?? null);
      if (mounted) setIsLoading(false);
    };

    init();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setIsLoading(true);
      setTimeout(async () => {
        await loadProfile(nextUser);
        if (mounted) setIsLoading(false);
      }, 0);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = React.useMemo<AuthContextValue>(() => {
    const role = profile?.role ?? null;
    return {
      user,
      profile,
      role,
      isLoading,
      profileError,
      isAuthenticated: Boolean(user),
      isAdmin: role === 'admin',
      isBusiness: role === 'business',
      isCreator: role === 'creator',
      refreshProfile,
      signOut: async () => { await supabase.auth.signOut(); },
    };
  }, [isLoading, profile, profileError, refreshProfile, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
