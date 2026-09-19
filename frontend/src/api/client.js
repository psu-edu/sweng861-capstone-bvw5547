/*
 * Central API client. Every request to the backend goes through api().
 * It attaches the Bearer token when the user is logged in.
 * On 401 it clears the auth state in one place, so no page
 * has to handle expired sessions by itself.
 */
const TOKEN_KEY = 'campusworks_token'

let unauthorizedHandler = null

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  } catch {
    /* storage unavailable */
  }
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = {}
  const token = getToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  let response
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Please try again.')
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    /* empty body */
  }

  if (response.status === 401) {
    if (unauthorizedHandler) {
      unauthorizedHandler()
    }
    throw new ApiError(401, data?.message || 'Your session has expired. Please log in again.')
  }
  if (!response.ok) {
    throw new ApiError(response.status, data?.message || 'Request failed')
  }
  return data
}
