const BASE_URL = import.meta.env.VITE_API_URL;

async function request(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || `Request failed with ${res.status}`);
  }
  return data;
}

export const api = {
  health: () => request("/api/health"),
  register: (email, password) => request("/api/auth/register", { method: "POST", body: { email, password } }),
  login: (email, password) => request("/api/auth/login", { method: "POST", body: { email, password } }),
  listMenu: () => request("/api/menu"),
  createMenuItem: (token, item) => request("/api/menu", { method: "POST", token, body: item }),
  updateMenuItem: (token, id, patch) => request(`/api/menu/${id}`, { method: "PUT", token, body: patch }),
  deleteMenuItem: (token, id) => request(`/api/menu/${id}`, { method: "DELETE", token }),
};
