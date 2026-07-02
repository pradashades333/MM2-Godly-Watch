const API_BASE = import.meta.env.VITE_API_BASE || "/api";

async function request(path, token, options = {}) {
  const res = await fetch(`${API_BASE}/account${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const getMe = (token) => request("/me", token);

export const getFavorites = (token) => request("/favorites", token);

export const putFavorites = (token, game, itemIds) =>
  request(`/favorites/${game}`, token, {
    method: "PUT",
    body: JSON.stringify({ itemIds }),
  });

export const getNotifications = (token) => request("/notifications", token);

export const markNotificationsRead = (token) =>
  request("/notifications/read", token, { method: "POST" });

export const createPremiumSession = (token, successUrl, cancelUrl) =>
  request("/premium-session", token, {
    method: "POST",
    body: JSON.stringify({ successUrl, cancelUrl }),
  });

export const confirmPremium = (token, sessionId) =>
  request("/confirm-premium", token, {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
