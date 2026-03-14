import './App.css'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { fetchHealth, generateReport, getReport, listReports, submitFeedback } from './api'
import type { AnalysisReport, AnalysisReportCard, AnalysisRequest, FeedbackPayload } from './types'

type WizardFormState = {
  productName: string
  oneLiner: string
  targetAudience: string
  industry: string
  geographies: string
  problemStatement: string
  proposedSolution: string
  differentiators: string
  constraints: string
  teamSize: string
  runwayMonths: string
  budgetUsd: string
  expectedTimelineWeeks: string
  technicalComplexity: 'low' | 'medium' | 'high'
  salesReadiness: string
  opsReadiness: string
}

const STORAGE_KEY = 'go-launch-reports-v2'

const sampleForm: WizardFormState = {
  productName: 'GoLaunch AI',
  oneLiner: 'Decision intelligence for startup and product launch evaluation',
  targetAudience: 'Startup founders and enterprise product managers',
  industry: 'SaaS',
  geographies: 'US, EU, India',
  problemStatement:
    'Organizations struggle to decide whether to launch new products because market validation, competitor intelligence, and internal readiness signals are fragmented, delayed, and expensive to synthesize.',
  proposedSolution:
    'GoLaunch AI combines market research, competitor analysis, internal operational readiness, and explainable risk scoring into one decision platform with investor-ready output.',
  differentiators: 'multi-agent market research, readiness scoring, RAG context retrieval, investor narrative generation',
  constraints: 'Need MVP in 5 months, initial ICP is B2B SaaS teams',
  teamSize: '14',
  runwayMonths: '16',
  budgetUsd: '300000',
  expectedTimelineWeeks: '18',
  technicalComplexity: 'medium',
  salesReadiness: '72',
  opsReadiness: '68',
}

function parseCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function toAnalysisPayload(form: WizardFormState): AnalysisRequest {
  return {
    idea: {
      productName: form.productName,
      oneLiner: form.oneLiner,
      targetAudience: form.targetAudience,
      industry: form.industry,
      geographies: parseCsv(form.geographies),
      problemStatement: form.problemStatement,
      proposedSolution: form.proposedSolution,
      differentiators: parseCsv(form.differentiators),
    },
    internalMetrics: {
      teamSize: Number(form.teamSize),
      runwayMonths: Number(form.runwayMonths),
      budgetUsd: Number(form.budgetUsd),
      expectedTimelineWeeks: Number(form.expectedTimelineWeeks),
      technicalComplexity: form.technicalComplexity,
      salesReadiness: Number(form.salesReadiness),
      opsReadiness: Number(form.opsReadiness),
    },
    constraints: parseCsv(form.constraints),
  }
}

function loadReportsFromStorage(): AnalysisReport[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    return JSON.parse(raw) as AnalysisReport[]
  } catch {
    return []
  }
}

function saveReportsToStorage(reports: AnalysisReport[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reports))
}

function upsertReport(reports: AnalysisReport[], report: AnalysisReport) {
  const next = reports.filter((item) => item.requestId !== report.requestId)
  next.unshift(report)
  return next
}

function useReportsStore() {
  const [reports, setReports] = useState<AnalysisReport[]>(() => loadReportsFromStorage())

  const saveReport = (report: AnalysisReport) => {
    setReports((current) => {
      const next = upsertReport(current, report)
      saveReportsToStorage(next)
      return next
    })
  }

  const hydrateReports = (nextReports: AnalysisReport[]) => {
    setReports((current) => {
      const merged = [...current]
      for (const report of nextReports) {
        const idx = merged.findIndex((item) => item.requestId === report.requestId)
        if (idx >= 0) {
          merged[idx] = report
        } else {
          merged.unshift(report)
        }
      }
      saveReportsToStorage(merged)
      return merged
    })
  }

  return { reports, saveReport, hydrateReports }
}

function ScorePill({ recommendation }: { recommendation: AnalysisReport['scoring']['recommendation'] }) {
  const classes =
    recommendation === 'launch'
      ? 'bg-emerald-100 text-emerald-700'
      : recommendation === 'launch-with-caution'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-rose-100 text-rose-700'

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${classes}`}>{recommendation.replace(/-/g, ' ')}</span>
}

function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="landing-shell min-h-screen px-6 pb-20 pt-10 md:px-12 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <div className="text-lg font-bold tracking-[0.08em] text-slate-200">GoLaunch AI</div>
          <button className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200 hover:bg-white/10" onClick={() => navigate('/dashboard')} type="button">
            Open dashboard
          </button>
        </header>

        <section className="mt-14 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="inline-flex items-center rounded-full border border-teal-200/30 bg-teal-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-teal-200">
              Market + readiness intelligence
            </p>
            <h1 className="mt-6 text-5xl font-bold leading-[0.94] tracking-[-0.05em] text-white md:text-7xl">
              Launch only when the evidence says yes.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
              Validate startup ideas with market signals, competitor pressure, execution readiness, risk scoring, and investor-ready narratives from one guided workflow.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <button className="rounded-2xl bg-teal-300 px-7 py-4 text-sm font-bold text-slate-900 transition hover:bg-teal-200" onClick={() => navigate('/dashboard')} type="button">
                Get started
              </button>
              <button className="rounded-2xl border border-white/25 bg-white/5 px-7 py-4 text-sm font-semibold text-white transition hover:bg-white/10" onClick={() => navigate('/analysis/new')} type="button">
                Run quick analysis
              </button>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">What you get</p>
            <div className="mt-5 space-y-4">
              {[
                'A multi-agent market and competitor report',
                'Operational readiness and risk decomposition',
                'Interactive chart views from backend chart payloads',
                'Persistent report history and feedback loop',
              ].map((point) => (
                <div key={point} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-200">
                  {point}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function DashboardPage({ reportCards }: { reportCards: AnalysisReportCard[] }) {
  const navigate = useNavigate()

  return (
    <div className="page-shell min-h-screen px-6 pb-20 pt-10 md:px-12 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace</p>
            <h1 className="mt-2 text-4xl font-bold tracking-[-0.04em] text-slate-900">Idea Dashboard</h1>
            <p className="mt-3 text-sm text-slate-500">No sidebar is shown here by design. Open an existing analysis to unlock the full report workspace.</p>
          </div>
          <button className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800" onClick={() => navigate('/analysis/new')} type="button">
            + Create new analysis
          </button>
        </header>

        {reportCards.length === 0 ? (
          <div className="mt-8 rounded-[28px] border border-slate-200 bg-white p-8 text-center">
            <h2 className="text-2xl font-semibold text-slate-900">No analysis yet</h2>
            <p className="mt-3 text-sm text-slate-500">Start with a multi-step form and generate your first startup viability report.</p>
            <button className="mt-6 rounded-xl bg-teal-500 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-600" onClick={() => navigate('/analysis/new')} type="button">
              Start first analysis
            </button>
          </div>
        ) : (
          <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {reportCards.map((report) => (
              <article className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm" key={report.requestId}>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">{report.productName}</h2>
                  <ScorePill recommendation={report.recommendation} />
                </div>
                <p className="mt-3 text-sm text-slate-500">{report.oneLiner}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">Viability</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{report.viabilityScore}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">Risk</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{report.riskScore}</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-slate-400">Generated {new Date(report.generatedAt).toLocaleString()}</p>
                <button className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => navigate(`/analysis/${report.requestId}/overview`)} type="button">
                  Open analysis workspace
                </button>
              </article>
            ))}
          </section>
        )}
      </div>
    </div>
  )
}

function WizardPage({ saveReport }: { saveReport: (report: AnalysisReport) => void }) {
  const navigate = useNavigate()
  const [form, setForm] = useState<WizardFormState>(sampleForm)
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const steps = ['Idea basics', 'Market context', 'Execution inputs']

  function updateField<K extends keyof WizardFormState>(field: K, value: WizardFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      const payload = toAnalysisPayload(form)
      const report = await generateReport(payload)
      saveReport(report)
      navigate(`/analysis/${report.requestId}/overview`)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Failed to create analysis.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-shell min-h-screen px-6 pb-20 pt-10 md:px-12 lg:px-16">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">New analysis</p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-slate-900">Multi-step setup</h1>
          </div>
          <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => navigate('/dashboard')} type="button">
            Back to dashboard
          </button>
        </header>

        <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-6">
          <div className="grid grid-cols-3 gap-3">
            {steps.map((item, index) => (
              <div className={`rounded-xl px-4 py-3 text-center text-sm font-semibold ${index <= step ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`} key={item}>
                {index + 1}. {item}
              </div>
            ))}
          </div>

          <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
            {step === 0 ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <input className="field-input" placeholder="Product name" value={form.productName} onChange={(event) => updateField('productName', event.target.value)} />
                  <input className="field-input" placeholder="Industry" value={form.industry} onChange={(event) => updateField('industry', event.target.value)} />
                </div>
                <input className="field-input" placeholder="One-liner" value={form.oneLiner} onChange={(event) => updateField('oneLiner', event.target.value)} />
                <input className="field-input" placeholder="Target audience" value={form.targetAudience} onChange={(event) => updateField('targetAudience', event.target.value)} />
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-4">
                <input className="field-input" placeholder="Geographies (comma separated)" value={form.geographies} onChange={(event) => updateField('geographies', event.target.value)} />
                <textarea className="field-input min-h-28" placeholder="Problem statement" value={form.problemStatement} onChange={(event) => updateField('problemStatement', event.target.value)} />
                <textarea className="field-input min-h-28" placeholder="Proposed solution" value={form.proposedSolution} onChange={(event) => updateField('proposedSolution', event.target.value)} />
                <textarea className="field-input min-h-20" placeholder="Differentiators (comma separated)" value={form.differentiators} onChange={(event) => updateField('differentiators', event.target.value)} />
                <textarea className="field-input min-h-20" placeholder="Constraints (comma separated)" value={form.constraints} onChange={(event) => updateField('constraints', event.target.value)} />
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <input className="field-input" min="1" placeholder="Team size" type="number" value={form.teamSize} onChange={(event) => updateField('teamSize', event.target.value)} />
                  <input className="field-input" min="0" placeholder="Runway months" type="number" value={form.runwayMonths} onChange={(event) => updateField('runwayMonths', event.target.value)} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <input className="field-input" min="0" placeholder="Budget USD" type="number" value={form.budgetUsd} onChange={(event) => updateField('budgetUsd', event.target.value)} />
                  <input className="field-input" min="1" placeholder="Timeline weeks" type="number" value={form.expectedTimelineWeeks} onChange={(event) => updateField('expectedTimelineWeeks', event.target.value)} />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <select className="field-input" value={form.technicalComplexity} onChange={(event) => updateField('technicalComplexity', event.target.value as WizardFormState['technicalComplexity'])}>
                    <option value="low">Low complexity</option>
                    <option value="medium">Medium complexity</option>
                    <option value="high">High complexity</option>
                  </select>
                  <input className="field-input" max="100" min="0" placeholder="Sales readiness" type="number" value={form.salesReadiness} onChange={(event) => updateField('salesReadiness', event.target.value)} />
                  <input className="field-input" max="100" min="0" placeholder="Ops readiness" type="number" value={form.opsReadiness} onChange={(event) => updateField('opsReadiness', event.target.value)} />
                </div>
              </div>
            ) : null}

            {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50" disabled={step === 0 || busy} onClick={() => setStep((current) => Math.max(0, current - 1))} type="button">
                Previous
              </button>

              <button className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50" disabled={busy} onClick={() => step < 2 && setStep((current) => Math.min(2, current + 1))} type={step === 2 ? 'submit' : 'button'}>
                {step === 2 ? (busy ? 'Generating...' : 'Generate analysis') : 'Next step'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function AnalysisWorkspace({ reports, saveReport }: { reports: AnalysisReport[]; saveReport: (report: AnalysisReport) => void }) {
  const { requestId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [report, setReport] = useState<AnalysisReport | null>(() => reports.find((item) => item.requestId === requestId) ?? null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')
  const [feedbackOutcome, setFeedbackOutcome] = useState<FeedbackPayload['outcome']>('partial')
  const [launched, setLaunched] = useState(true)
  const [feedbackNotes, setFeedbackNotes] = useState('')
  const [sendingFeedback, setSendingFeedback] = useState(false)

  useEffect(() => {
    if (report) {
      return
    }

    setStatus('loading')
    getReport(requestId)
      .then((fetched) => {
        setReport(fetched)
        saveReport(fetched)
        setStatus('idle')
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load report')
        setStatus('error')
      })
  }, [report, requestId, saveReport])

  const currentTab = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean)
    return parts[3] ?? 'overview'
  }, [location.pathname])

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'charts', label: 'Charts' },
    { key: 'report', label: 'Narrative' },
    { key: 'sources', label: 'Sources' },
    { key: 'feedback', label: 'Feedback' },
  ]

  async function handleFeedbackSubmit() {
    if (!report) {
      return
    }

    setSendingFeedback(true)
    setError('')

    try {
      await submitFeedback({
        requestId: report.requestId,
        launched,
        outcome: feedbackOutcome,
        notes: feedbackNotes || undefined,
        correctedScores: {
          viability: report.scoring.overallViabilityScore,
          risk: report.risk.riskScore,
        },
      })
    } catch (feedbackError) {
      setError(feedbackError instanceof Error ? feedbackError.message : 'Feedback failed')
    } finally {
      setSendingFeedback(false)
    }
  }

  if (status === 'loading') {
    return <div className="grid min-h-screen place-items-center text-slate-500">Loading analysis...</div>
  }

  if (!report) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Analysis not found</h2>
          <p className="mt-2 text-sm text-slate-500">{error || 'This report is unavailable or has not been created yet.'}</p>
          <button className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white" onClick={() => navigate('/dashboard')} type="button">
            Go to dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-6 md:px-6">
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-64 shrink-0 rounded-[26px] border border-slate-200 bg-white p-4 lg:block">
          <div className="rounded-2xl bg-slate-950 p-4 text-white">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Analysis workspace</p>
            <h3 className="mt-2 text-lg font-semibold">{report.idea.productName}</h3>
            <p className="mt-2 text-xs text-slate-300">ID: {report.requestId.slice(0, 8)}...</p>
          </div>

          <nav className="mt-5 space-y-2">
            {tabs.map((tab) => (
              <NavLink className={({ isActive }) => `block rounded-xl px-4 py-3 text-sm font-semibold transition ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`} key={tab.key} to={`/analysis/${report.requestId}/${tab.key}`}>
                {tab.label}
              </NavLink>
            ))}
          </nav>

          <button className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => navigate('/dashboard')} type="button">
            Back to dashboard
          </button>
        </aside>

        <main className="w-full space-y-6">
          <header className="rounded-[24px] border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{currentTab}</p>
                <h1 className="mt-1 text-2xl font-bold text-slate-900">{report.idea.productName}</h1>
              </div>
              <ScorePill recommendation={report.scoring.recommendation} />
            </div>
          </header>

          {currentTab === 'overview' ? (
            <section className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {report.charts.scoreBreakdown.map((item) => (
                  <article className="rounded-2xl border border-slate-200 bg-white p-4" key={item.metric}>
                    <p className="text-sm text-slate-500">{item.metric}</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{item.score}</p>
                    <div className="mt-3 h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-teal-400" style={{ width: `${item.score}%` }} />
                    </div>
                  </article>
                ))}
              </div>

              <article className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-xl font-semibold text-slate-900">Executive summary</h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">{report.executiveSummary}</p>
              </article>
            </section>
          ) : null}

          {currentTab === 'charts' ? (
            <section className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                <article className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="text-lg font-semibold text-slate-900">Radar profile</h2>
                  <div className="mt-4 h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={report.charts.radarMetrics}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="metric" tick={{ fill: '#64748b' }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={false} />
                        <Radar dataKey="score" fill="#14b8a6" fillOpacity={0.4} stroke="#0f766e" strokeWidth={2} />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="text-lg font-semibold text-slate-900">Score breakdown</h2>
                  <div className="mt-4 h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.charts.scoreBreakdown}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="metric" tick={{ fill: '#64748b' }} />
                        <YAxis domain={[0, 100]} tick={{ fill: '#64748b' }} />
                        <Tooltip />
                        <Bar dataKey="score" radius={[10, 10, 0, 0]}>
                          {report.charts.scoreBreakdown.map((item) => (
                            <Cell fill={item.metric === 'Risk' ? '#fb7185' : '#2dd4bf'} key={item.metric} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </article>
              </div>

              <article className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-semibold text-slate-900">Trend projection</h2>
                <div className="mt-4 h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={report.charts.trendProjection}>
                      <defs>
                        <linearGradient id="demandGradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="competitionGradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="riskGradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#fb7185" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#fb7185" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="phase" tick={{ fill: '#64748b' }} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#64748b' }} />
                      <Tooltip />
                      <Area dataKey="demand" fill="url(#demandGradient)" stroke="#0f766e" strokeWidth={2} type="monotone" />
                      <Area dataKey="competition" fill="url(#competitionGradient)" stroke="#4f46e5" strokeWidth={2} type="monotone" />
                      <Area dataKey="risk" fill="url(#riskGradient)" stroke="#e11d48" strokeWidth={2} type="monotone" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                <article className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="text-lg font-semibold text-slate-900">Risk distribution</h2>
                  <div className="mt-4 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.charts.riskDistribution} layout="vertical">
                        <CartesianGrid horizontal={false} stroke="#e2e8f0" />
                        <XAxis domain={[0, 100]} type="number" tick={{ fill: '#64748b' }} />
                        <YAxis dataKey="category" type="category" width={140} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="score" radius={[0, 12, 12, 0]}>
                          {report.charts.riskDistribution.map((item) => (
                            <Cell fill={item.score >= 80 ? '#fb7185' : item.score >= 50 ? '#f59e0b' : '#2dd4bf'} key={item.category} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="text-lg font-semibold text-slate-900">Source distribution</h2>
                  <div className="mt-4 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={report.charts.sourceDistribution} dataKey="count" innerRadius={55} outerRadius={95} nameKey="domain" paddingAngle={2}>
                          {report.charts.sourceDistribution.map((item, index) => (
                            <Cell fill={['#14b8a6', '#38bdf8', '#6366f1', '#f59e0b', '#f43f5e'][index % 5]} key={item.domain} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </article>
              </div>
            </section>
          ) : null}

          {currentTab === 'report' ? (
            <section className="space-y-6">
              <article className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-xl font-semibold text-slate-900">Investor narrative</h2>
                <p className="mt-4 text-sm leading-8 text-slate-600">{report.investorNarrative}</p>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-xl font-semibold text-slate-900">Action plan</h2>
                <div className="mt-4 space-y-3">
                  {report.actionPlan.map((step, index) => (
                    <div className="flex gap-3 rounded-xl bg-slate-50 p-3" key={step}>
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white">{index + 1}</span>
                      <p className="text-sm leading-7 text-slate-600">{step}</p>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          ) : null}

          {currentTab === 'sources' ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-slate-900">Source URLs</h2>
              <div className="mt-4 grid gap-3">
                {report.rawSources.map((source) => (
                  <a className="truncate rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50" href={source} key={source} rel="noreferrer" target="_blank">
                    {source}
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {currentTab === 'feedback' ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-slate-900">Feedback loop</h2>
              <p className="mt-2 text-sm text-slate-500">Store real launch outcomes to improve future analysis quality.</p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <select className="field-input" value={feedbackOutcome} onChange={(event) => setFeedbackOutcome(event.target.value as FeedbackPayload['outcome'])}>
                  <option value="success">Success</option>
                  <option value="partial">Partial</option>
                  <option value="failure">Failure</option>
                </select>
                <select className="field-input" value={launched ? 'yes' : 'no'} onChange={(event) => setLaunched(event.target.value === 'yes')}>
                  <option value="yes">Launched</option>
                  <option value="no">Not launched</option>
                </select>
              </div>
              <textarea className="field-input mt-4 min-h-32" placeholder="What happened after launch?" value={feedbackNotes} onChange={(event) => setFeedbackNotes(event.target.value)} />
              {error ? <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
              <button className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50" disabled={sendingFeedback} onClick={handleFeedbackSubmit} type="button">
                {sendingFeedback ? 'Submitting...' : 'Submit feedback'}
              </button>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  )
}

function AppRouter() {
  const { reports, saveReport } = useReportsStore()
  const [health, setHealth] = useState<'checking' | 'online' | 'offline'>('checking')
  const [reportCards, setReportCards] = useState<AnalysisReportCard[]>([])

  useEffect(() => {
    listReports()
      .then((cards) => {
        setReportCards(cards)
      })
      .catch(() => {
        // Fallback to local cache-derived cards if backend list is unavailable.
        setReportCards(
          reports.map((report) => ({
            requestId: report.requestId,
            generatedAt: report.generatedAt,
            productName: report.idea.productName,
            oneLiner: report.idea.oneLiner,
            recommendation: report.scoring.recommendation,
            viabilityScore: report.scoring.overallViabilityScore,
            riskScore: report.risk.riskScore,
          }))
        )
      })
  }, [reports])

  useEffect(() => {
    fetchHealth()
      .then(() => setHealth('online'))
      .catch(() => setHealth('offline'))
  }, [])

  return (
    <>
      <div className="fixed right-4 top-4 z-50 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 shadow-sm">
        API {health}
      </div>
      <Routes>
        <Route element={<LandingPage />} path="/" />
        <Route element={<DashboardPage reportCards={reportCards} />} path="/dashboard" />
        <Route element={<WizardPage saveReport={saveReport} />} path="/analysis/new" />
        <Route element={<AnalysisWorkspace reports={reports} saveReport={saveReport} />} path="/analysis/:requestId/:tab" />
        <Route element={<Navigate replace to="/dashboard" />} path="*" />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  )
}
