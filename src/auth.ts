const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

const AUTH_TOKEN_KEY = 'go-launch-auth-token'
const AUTH_USER_KEY = 'go-launch-auth-user'

type AuthResponse = {
  token: string
  user: AppAuthUser
}

export type AppAuthUser = {
  id: string
  email: string
}

let currentUser: AppAuthUser | null = readStoredUser()
let currentToken: string | null = readStoredToken()
let initialized = false
const listeners = new Set<(user: AppAuthUser | null) => void>()

function readStoredToken() {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

function readStoredUser(): AppAuthUser | null {
  try {
    const raw = window.localStorage.getItem(AUTH_USER_KEY)
    return raw ? (JSON.parse(raw) as AppAuthUser) : null
  } catch {
    return null
  }
}

function writeStoredSession(session: AuthResponse | null) {
  if (!session) {
    currentToken = null
    currentUser = null
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
    window.localStorage.removeItem(AUTH_USER_KEY)
    return
  }

  currentToken = session.token
  currentUser = session.user
  window.localStorage.setItem(AUTH_TOKEN_KEY, session.token)
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user))
}

function notify() {
  listeners.forEach((listener) => listener(currentUser))
}

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  const text = await response.text()
  let payload: unknown = null

  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!response.ok) {
    if (payload && typeof payload === 'object' && 'message' in payload) {
      throw new Error(String((payload as { message: unknown }).message))
    }
    throw new Error(typeof payload === 'string' ? payload : `Request failed with status ${response.status}`)
  }

  return payload as T
}

async function bootstrapSession() {
  if (initialized) return
  initialized = true

  if (!currentToken) {
    if (currentUser) {
      writeStoredSession(null)
    }
    notify()
    return
  }

  try {
    const result = await authRequest<{ user: AppAuthUser }>('/api/v1/auth/me', {
      headers: {
        Authorization: `Bearer ${currentToken}`,
      },
    })

    writeStoredSession({ token: currentToken, user: result.user })
  } catch {
    writeStoredSession(null)
  }

  notify()
}

export function getAuthToken() {
  return currentToken
}

export function subscribeToAuthState(listener: (user: AppAuthUser | null) => void) {
  listeners.add(listener)
  listener(currentUser)
  void bootstrapSession()

  return () => {
    listeners.delete(listener)
  }
}

export async function loginWithEmail(email: string, password: string) {
  const session = await authRequest<AuthResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  writeStoredSession(session)
  notify()
  return session.user
}

export async function signupWithEmail(email: string, password: string) {
  const session = await authRequest<AuthResponse>('/api/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  writeStoredSession(session)
  notify()
  return session.user
}

export async function logout() {
  writeStoredSession(null)
  notify()
}
