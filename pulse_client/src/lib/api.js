export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || data.error || `Request failed (${response.status})`)
  return data
}

export async function apiAuth(path, authToken, options = {}) {
  return apiFetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}`, ...options.headers },
  })
}
