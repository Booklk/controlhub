import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthToken, useAuth } from "./auth";

let isRedirectingToLogin = false;

function handleSessionExpired() {
  if (isRedirectingToLogin) return;
  isRedirectingToLogin = true;
  
  useAuth.getState().logout();
  clearCSRFToken();
  sessionStorage.setItem('session_expired', 'true');
  
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
  
  setTimeout(() => { isRedirectingToLogin = false; }, 3000);
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 401) {
      handleSessionExpired();
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

let csrfToken: string | null = null;
let csrfTokenPromise: Promise<string | null> | null = null;
let csrfTokenFetched = false;

export async function fetchCSRFToken(): Promise<string | null> {
  if (csrfTokenPromise) {
    return csrfTokenPromise;
  }
  
  csrfTokenPromise = (async () => {
    try {
      const res = await fetch('/api/csrf-token', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        csrfToken = data.csrfToken;
        csrfTokenFetched = true;
        return csrfToken;
      }
    } catch (error) {
      console.error('Failed to fetch CSRF token:', error);
    } finally {
      csrfTokenPromise = null;
    }
    return null;
  })();
  
  return csrfTokenPromise;
}

export function getCSRFToken(): string | null {
  return csrfToken;
}

export function clearCSRFToken(): void {
  csrfToken = null;
  csrfTokenFetched = false;
}

export async function ensureCSRFToken(): Promise<string | null> {
  if (csrfToken) {
    return csrfToken;
  }
  return fetchCSRFToken();
}

if (typeof window !== 'undefined') {
  fetchCSRFToken();
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (data) {
    headers['Content-Type'] = 'application/json';
  }
  
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
  if (isStateChanging) {
    const csrf = await ensureCSRFToken();
    if (csrf) {
      headers['x-csrf-token'] = csrf;
    }
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  
  if (res.status === 403 && isStateChanging) {
    const errorText = await res.clone().text();
    if (errorText.includes('CSRF')) {
      clearCSRFToken();
      const newCsrf = await fetchCSRFToken();
      if (newCsrf) {
        headers['x-csrf-token'] = newCsrf;
        const retryRes = await fetch(url, {
          method,
          headers,
          body: data ? JSON.stringify(data) : undefined,
          credentials: "include",
        });
        await throwIfResNotOk(retryRes);
        return retryRes;
      }
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const url = queryKey.filter(k => typeof k === 'string').join("/");
    const res = await fetch(url, {
      credentials: "include",
      headers,
    });

    if (res.status === 401) {
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
      handleSessionExpired();
      throw new Error('401: انتهت صلاحية الجلسة');
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

const RELATED_QUERIES: Record<string, string[]> = {
  '/api/it-tickets': ['/api/dashboard/stats', '/api/dashboard/it-director', '/api/dashboard/support'],
  '/api/tasks': ['/api/dashboard/stats', '/api/dashboard/it-director', '/api/planner/my-tasks', '/api/tasks/assigned-by-me'],
  '/api/projects': ['/api/dashboard/stats', '/api/dashboard/it-director', '/api/it-projects'],
  '/api/it-projects': ['/api/dashboard/stats', '/api/dashboard/it-director', '/api/projects'],
  '/api/it-referrals': ['/api/dashboard/stats', '/api/dashboard/it-director'],
  '/api/escalations': ['/api/dashboard/stats', '/api/escalations/pending'],
  '/api/external-systems': ['/api/dashboard/stats', '/api/external-systems/pending-approvals'],
  '/api/security-incidents': ['/api/dashboard/cybersecurity', '/api/dashboard/stats'],
  '/api/security-vulnerabilities': ['/api/dashboard/cybersecurity', '/api/security/vulnerabilities/critical'],
  '/api/security-threats': ['/api/dashboard/cybersecurity', '/api/security/threats/active'],
  '/api/digital-initiatives': ['/api/dashboard/digital-transformation', '/api/dashboard/stats'],
  '/api/digital-applications': ['/api/dashboard/digital-transformation'],
  '/api/cloud-services': ['/api/dashboard/digital-transformation'],
  '/api/infrastructure/servers': ['/api/dashboard/infrastructure', '/api/dashboard/stats'],
  '/api/infrastructure/networks': ['/api/dashboard/infrastructure'],
  '/api/infrastructure/storage': ['/api/dashboard/infrastructure'],
  '/api/infrastructure/monitoring': ['/api/dashboard/infrastructure'],
  '/api/users': ['/api/dashboard/stats', '/api/dashboard/admin-charts'],
  '/api/planner/tasks': ['/api/planner/my-tasks', '/api/planner/team-tasks', '/api/planner/overdue-tasks', '/api/planner/charts', '/api/planner/timeline'],
  '/api/planner/boards': ['/api/planner/charts'],
  '/api/planner/buckets': ['/api/planner/charts'],
  '/api/voting-sessions': ['/api/dashboard/committee'],
  '/api/committee/decisions': ['/api/dashboard/committee'],
  '/api/committee-meetings': ['/api/dashboard/committee'],
  '/api/committee-members': ['/api/dashboard/committee'],
  '/api/regulatory-controls': ['/api/regulatory-controls/stats', '/api/regulatory-controls/dashboard'],
  '/api/vendors': ['/api/dashboard/stats'],
  '/api/kpis': ['/api/dashboard/stats'],
  '/api/data-quality': ['/api/data-quality/health', '/api/data-quality/checks'],
  '/api/notifications': ['/api/notifications/unread'],
};

export function invalidateRelatedQueries(primaryKey: string) {
  queryClient.invalidateQueries({ queryKey: [primaryKey] });
  
  const related = RELATED_QUERIES[primaryKey];
  if (related) {
    related.forEach(key => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });
  }
}

export function broadcastMutation(affectedKeys: string[]) {
  affectedKeys.forEach(key => {
    invalidateRelatedQueries(key);
  });
}

// Stale time presets — use these for consistent caching across the app
export const STALE = {
  STATIC: 10 * 60 * 1000,    // 10 min — rarely changes (departments, users, vendors)
  SLOW: 5 * 60 * 1000,       // 5 min  — changes occasionally (catalog, stewards, risks)
  NORMAL: 2 * 60 * 1000,     // 2 min  — standard data (tickets, projects, tasks)
  FAST: 60 * 1000,            // 1 min  — frequent updates (dashboard stats, KPIs)
  REALTIME: 30 * 1000,        // 30 sec — near real-time (notifications, monitoring)
} as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,  // Disabled globally — prevents burst requests on tab focus
      refetchOnReconnect: true,     // Refetch when network reconnects
      staleTime: STALE.NORMAL,      // 2 min default — significantly improved from 1 min
      gcTime: 10 * 60 * 1000,       // Keep cache for 10 min
      retry: (failureCount, error) => {
        if (error instanceof Error && /^(401|403)/.test(error.message)) return false;
        return failureCount < 1;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
