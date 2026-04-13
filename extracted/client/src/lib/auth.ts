import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: number;
  email: string;
  name: string;
  nameEn?: string;
  role: string;
  portal: string;
  avatar?: string;
  jobTitle?: string;
  departmentId?: number;
  itDepartmentId?: number;
  mustChangePassword?: boolean;
  isCommitteeMember?: boolean;
  committeeRole?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  initFromSession: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,
      login: (token: string, user: User) => {
        try { sessionStorage.setItem('_cht', token); } catch (e) { console.warn('[Auth] sessionStorage write failed:', e); }
        set({ token, user, isAuthenticated: true });
        scheduleTokenRefresh(token);
      },
      logout: () => {
        try { sessionStorage.removeItem('_cht'); } catch {}
        clearRefreshTimer();
        set({ token: null, user: null, isAuthenticated: false });
      },
      setUser: (user: User) => {
        set({ user });
      },
      initFromSession: () => {
        try {
          const token = sessionStorage.getItem('_cht');
          if (token) {
            set((state) => ({ ...state, token, isAuthenticated: !!state.user }));
            scheduleTokenRefresh(token);
          }
        } catch {}
      },
    }),
    {
      name: 'control-hub-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export const getAuthToken = (): string | null => {
  return useAuth.getState().token || (() => {
    try { return sessionStorage.getItem('_cht'); } catch { return null; }
  })();
};

export const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let isRefreshing = false;

function clearRefreshTimer() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function scheduleTokenRefresh(token: string) {
  clearRefreshTimer();
  const expiry = getTokenExpiry(token);
  if (!expiry) return;

  const now = Date.now();
  const timeUntilExpiry = expiry - now;

  if (timeUntilExpiry <= 0) {
    refreshAccessToken();
    return;
  }

  const refreshAt = Math.max(timeUntilExpiry - 10 * 60 * 1000, 5 * 1000);

  refreshTimer = setTimeout(() => {
    refreshAccessToken();
  }, refreshAt);
}

async function refreshAccessToken() {
  if (isRefreshing) return;
  isRefreshing = true;

  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });

    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        const state = useAuth.getState();
        const user = data.user || state.user;
        if (state.isAuthenticated && user) {
          state.login(data.token, user);
        }
      }
    } else if (res.status === 401) {
      useAuth.getState().logout();
      sessionStorage.setItem('session_expired', 'true');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
  } catch (err) {
    console.warn('[Auth] Token refresh failed, retrying in 30s:', err instanceof Error ? err.message : 'Unknown error');
    refreshTimer = setTimeout(() => refreshAccessToken(), 30000);
  } finally {
    isRefreshing = false;
  }
}
