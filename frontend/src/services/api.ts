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

export async function getPosts(filters: { categoryId?: string; tagId?: string; q?: string; status?: string; featured?: boolean } = {}) {
  const params = new URLSearchParams();
  if (filters.categoryId) params.append('categoryId', filters.categoryId);
  if (filters.tagId) params.append('tagId', filters.tagId);
  if (filters.q) params.append('q', filters.q);
  if (filters.status) params.append('status', filters.status);
  if (filters.featured !== undefined) params.append('featured', String(filters.featured));
  
  const queryStr = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch(`/posts${queryStr}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to fetch posts');
  }
  return res.json();
}

// Fetch single post by ID or Slug (public or admin)
export async function getPost(idOrSlug: string) {
  const res = await apiFetch(`/posts/${idOrSlug}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to fetch post');
  }
  return res.json();
}

// Create Post (Admin only)
export async function createPost(postData: any) {
  const res = await apiFetch('/posts', {
    method: 'POST',
    body: JSON.stringify(postData),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to create post');
  }
  return res.json();
}

// Update Post (Admin only)
export async function updatePost(id: string, postData: any) {
  const res = await apiFetch(`/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(postData),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to update post');
  }
  return res.json();
}

// Delete Post (Admin only)
export async function deletePost(id: string) {
  const res = await apiFetch(`/posts/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to delete post');
  }
  return res.json();
}

