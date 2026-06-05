import { useAuthStore } from '../store/useAuthStore';

const BASE_URL = 'http://localhost:3000';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiFetch(path: string, options: RequestOptions = {}): Promise<Response> {
  const { accessToken, setAuth, clearAuth } = useAuthStore.getState();
  
  const headers = new Headers(options.headers || {});
  
  if (accessToken && !options.skipAuth) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Include credentials (cookies) for all requests to enable cookie storage for refresh tokens
  options.credentials = 'include';

  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, { ...options, headers });

  // If unauthorized and we have an active session, attempt automatic token refresh
  if (response.status === 401 && accessToken && !options.skipAuth) {
    try {
      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        setAuth(refreshData.accessToken, refreshData.user);
        
        // Retry the original request
        const retryHeaders = new Headers(options.headers || {});
        retryHeaders.set('Authorization', `Bearer ${refreshData.accessToken}`);
        if (options.body && !(options.body instanceof FormData) && !retryHeaders.has('Content-Type')) {
          retryHeaders.set('Content-Type', 'application/json');
        }
        return fetch(url, { ...options, headers: retryHeaders, credentials: 'include' });
      } else {
        clearAuth();
      }
    } catch (e) {
      clearAuth();
    }
  }

  return response;
}
