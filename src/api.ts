import type { AnalysisReport, AnalysisReportCard, AnalysisRequest, FeedbackPayload } from './types'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed with status ${response.status}`)
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
