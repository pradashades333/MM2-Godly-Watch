const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    let message = "Request failed";

    try {
      const data = await response.json();
      message = data.message || message;
    } catch {
      message = `${response.status} ${response.statusText}`;
    }

    throw new Error(message);
  }

  return response.json();
}
