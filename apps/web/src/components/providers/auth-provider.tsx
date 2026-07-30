'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@rosovia/core';
import { getSupabaseBrowserClient } from '~/lib/supabase/client';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  // FIX (RC-11): Store router in a ref so the useEffect does not re-run
  // on every navigation (useRouter() returns a new object each time in App Router).
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_user_id', userId)
        .is('deleted_at', null)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      return data as Profile;
    } catch (err) {
      console.error('Error in fetchProfile:', err);
      return null;
    }
  }, [supabase]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
      if (currentUser) {
        const p = await fetchProfile(currentUser.id);
        setProfile(p);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('Failed to refresh auth state:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, fetchProfile]);

  useEffect(() => {
    let isMounted = true;

    // FIX (RC-1): Use getUser() instead of getSession().
    // getUser() makes a network call to Supabase to verify the JWT,
    // ensuring we always have the current, verified auth state.
    // getSession() only reads from local storage/cookie cache and can be stale.
    const initAuth = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!isMounted) return;

        setUser(currentUser);

        if (currentUser) {
          const p = await fetchProfile(currentUser.id);
          if (isMounted) {
            setProfile(p);
          }
        }
      } catch (err) {
        console.error('Failed to initialize auth:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const p = await fetchProfile(currentUser.id);
        if (isMounted) {
          setProfile(p);
        }
      } else {
        setProfile(null);
      }

      if (event === 'SIGNED_IN') {
        routerRef.current.refresh();
      } else if (event === 'SIGNED_OUT') {
        routerRef.current.refresh();
        routerRef.current.push('/login');
      } else if (event === 'USER_UPDATED') {
        // Refresh server components when user metadata changes (e.g. profile update, password reset)
        routerRef.current.refresh();
      }
      // FIX (RC-2): Removed TOKEN_REFRESHED → router.refresh().
      // Token refreshes happen silently every ~55 minutes. Triggering a full
      // server component re-render on every refresh causes UI flickers, race
      // conditions, and unnecessary load. The middleware handles token refresh
      // transparently via its own getUser() call.
      
      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
    // FIX (RC-11): Removed `router` from dependency array.
    // router is accessed via routerRef inside callbacks, so the effect
    // does not need to re-run when the router object reference changes.
  }, [supabase, fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    routerRef.current.refresh();
    routerRef.current.push('/login');
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
