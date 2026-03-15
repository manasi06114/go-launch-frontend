import type {
  AnalysisReport,
  AnalysisReportCard,
  AnalysisRequest,
  FeedbackPayload,
  ReportChatRequest,
  ReportChatResponse,
  ReportChatMessage,
} from './types'
import { getAuthToken } from './auth'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken()
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const text = await response.text()
    if (text) {
      let message = text
      try {
        const payload = JSON.parse(text) as { message?: string }
        message = payload.message || text
      } catch {
        // Fall back to raw response text when body is not JSON.
      }
      throw new Error(message)
    }
    throw new Error(`Request failed with status ${response.status}`)
  }

  if (response.status === 202) {
    return { message: 'accepted' } as T
  }

  return (await response.json()) as T
}

export function fetchHealth() {
  return request<{ status: string; timestamp: string }>('/health')
}

export function generateReport(payload: AnalysisRequest) {
  return request<AnalysisReport>('/api/v1/analysis/report', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getReport(requestId: string) {
  return request<AnalysisReport>(`/api/v1/analysis/report/${requestId}`)
}

export function listReports() {
  return request<AnalysisReportCard[]>('/api/v1/analysis/reports')
}

export function submitFeedback(payload: FeedbackPayload) {
  return request<{ message: string }>('/api/v1/analysis/feedback', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getReportChat(requestId: string) {
  return request<{ messages: ReportChatMessage[] }>(`/api/v1/analysis/chat/${requestId}`)
}

export function sendReportChat(payload: ReportChatRequest) {
  return request<ReportChatResponse>('/api/v1/analysis/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function downloadPitchDeck(requestId: string): Promise<Blob> {
  const token = getAuthToken()
  const response = await fetch(`${apiBaseUrl}/api/v1/analysis/pitch-deck/${requestId}`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Pitch deck generation failed with status ${response.status}`)
  }

  return response.blob()
}
