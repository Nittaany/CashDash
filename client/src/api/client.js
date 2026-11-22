const API_URL = import.meta.env.VITE_API_URL || "";

let accessToken = null;
let isDemo = false;
let onDemoSessionEnd = null;

/**
 * Set the access token (stored in memory only)
 */
export function setAccessToken(token, demo = false) {
  accessToken = token;
  isDemo = demo;
}

/**
 * Get current access token
 */
export function getAccessToken() {
  return accessToken;
}

/**
 * Clear access token on logout
 */
export function clearAccessToken() {
  accessToken = null;
  isDemo = false;
}

/**
 * Set callback for demo session end
 */
export function setDemoSessionEndCallback(callback) {
  onDemoSessionEnd = callback;
}

/**
 * Core fetch wrapper with auth handling
 */
async function fetchWithAuth(endpoint, options = {}, skipAuthRetry = false) {
  const url = `${API_URL}${endpoint}`;

  const headers = {
    "Content-Type": "application/json",
    ...options.headers
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include" // For HttpOnly refresh cookies
  });

  // Handle 401 - try silent refresh once
  if (response.status === 401 && !skipAuthRetry) {
    const noRetryEndpoints = ["/api/auth/login", "/api/auth/register", "/api/auth/refresh"];
    if (!noRetryEndpoints.includes(endpoint)) {
      const refreshed = await silentRefresh();
      if (refreshed) {
        // Retry original request with new token
        return fetchWithAuth(endpoint, options, true);
      }
    }
  }

  return response;
}

/**
 * Attempt silent token refresh
 */
async function silentRefresh() {
  try {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include"
    });

    if (response.ok) {
      const data = await response.json();
      accessToken = data.accessToken;
      return true;
    }
    
    // Refresh failed - if demo user, trigger callback
    if (isDemo && onDemoSessionEnd) {
      onDemoSessionEnd();
    }
  } catch {
    // Refresh failed - if demo user, trigger callback
    if (isDemo && onDemoSessionEnd) {
      onDemoSessionEnd();
    }
  }
  accessToken = null;
  isDemo = false;
  return false;
}

/**
 * API client methods
 */
export const api = {
  async get(endpoint) {
    const res = await fetchWithAuth(endpoint);
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || "Request failed");
    }
    return res.json();
  },

  async post(endpoint, data) {
    const res = await fetchWithAuth(endpoint, {
      method: "POST",
      body: JSON.stringify(data)
    });
    const json = await res.json().catch(() => ({ error: "Request failed" }));
    if (!res.ok) {
      throw new Error(json.error || "Request failed");
    }
    return json;
  },

  async patch(endpoint, data) {
    const res = await fetchWithAuth(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data)
    });
    const json = await res.json().catch(() => ({ error: "Request failed" }));
    if (!res.ok) {
      throw new Error(json.error || "Request failed");
    }
    return json;
  },

  async delete(endpoint) {
    const res = await fetchWithAuth(endpoint, { method: "DELETE" });
    const json = await res.json().catch(() => ({ error: "Request failed" }));
    if (!res.ok) {
      throw new Error(json.error || "Request failed");
    }
    return json;
  },

  /**
   * Download file (for CSV export)
   */
  async download(endpoint, filename) {
    const res = await fetchWithAuth(endpoint);
    if (!res.ok) {
      throw new Error("Download failed");
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }
};

/**
 * Check API health (for cold start detection)
 */
export async function checkApiHealth() {
  try {
    const res = await fetch(`${API_URL}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}
