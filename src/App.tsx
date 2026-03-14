import './App.css'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
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
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'
import { fetchHealth, generateReport, getReport, listReports, submitFeedback } from './api'
import type {
  AnalysisReport,
  AnalysisReportCard,
  AnalysisRequest,
  FeedbackPayload,
} from './types'

// ─── Types ───────────────────────────────────────────────────────────────────

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

type FormErrors = Partial<Record<keyof WizardFormState, string>>

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'go-launch-reports-v2'

const EMPTY_FORM: WizardFormState = {
  productName: '',
  oneLiner: '',
  targetAudience: '',
  industry: '',
  geographies: '',
  problemStatement: '',
  proposedSolution: '',
  differentiators: '',
  constraints: '',
  teamSize: '',
  runwayMonths: '',
  budgetUsd: '',
  expectedTimelineWeeks: '',
  technicalComplexity: 'medium',
  salesReadiness: '',
  opsReadiness: '',
}

const ANALYSIS_STAGES = [
  'Initialising research agents',
  'Scanning market demand signals',
  'Scraping competitor landscape',
  'Processing web evidence',
  'Scoring execution readiness',
  'Decomposing risk factors',
  'Calculating viability scores',
  'Generating investor narrative',
  'Compiling final report',
]

// ─── Business Logic ───────────────────────────────────────────────────────────

function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function toAnalysisPayload(form: WizardFormState): AnalysisRequest {
  return {
    idea: {
      productName: form.productName.trim(),
      oneLiner: form.oneLiner.trim(),
      targetAudience: form.targetAudience.trim(),
      industry: form.industry.trim(),
      geographies: parseCsv(form.geographies),
      problemStatement: form.problemStatement.trim(),
      proposedSolution: form.proposedSolution.trim(),
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

function validateStep(step: number, form: WizardFormState): FormErrors {
  const e: FormErrors = {}
  if (step === 0) {
    if (!form.productName.trim()) e.productName = 'Required'
    if (!form.industry.trim()) e.industry = 'Required'
    if (!form.oneLiner.trim()) e.oneLiner = 'Required'
    else if (form.oneLiner.trim().length < 10) e.oneLiner = 'At least 10 characters'
    if (!form.targetAudience.trim()) e.targetAudience = 'Required'
  }
  if (step === 1) {
    if (!form.geographies.trim()) e.geographies = 'Add at least one geography'
    if (!form.problemStatement.trim()) e.problemStatement = 'Required'
    else if (form.problemStatement.trim().length < 30)
      e.problemStatement = 'Please be more specific (min 30 characters)'
    if (!form.proposedSolution.trim()) e.proposedSolution = 'Required'
    else if (form.proposedSolution.trim().length < 30)
      e.proposedSolution = 'Please be more specific (min 30 characters)'
    if (!form.differentiators.trim()) e.differentiators = 'Required'
  }
  if (step === 2) {
    if (!form.teamSize || Number(form.teamSize) < 1) e.teamSize = 'Enter a valid team size'
    if (form.runwayMonths === '' || Number(form.runwayMonths) < 0)
      e.runwayMonths = 'Required'
    if (form.budgetUsd === '' || Number(form.budgetUsd) < 0) e.budgetUsd = 'Required'
    if (!form.expectedTimelineWeeks || Number(form.expectedTimelineWeeks) < 1)
      e.expectedTimelineWeeks = 'Required'
    const sr = Number(form.salesReadiness)
    if (form.salesReadiness === '' || sr < 0 || sr > 100) e.salesReadiness = '0 – 100'
    const or = Number(form.opsReadiness)
    if (form.opsReadiness === '' || or < 0 || or > 100) e.opsReadiness = '0 – 100'
  }
  return e
}

// ─── Storage ─────────────────────────────────────────────────────────────────

function loadReports(): AnalysisReport[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AnalysisReport[]) : []
  } catch {
    return []
  }
}

function persistReports(reports: AnalysisReport[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reports))
}

function useReportsStore() {
  const [reports, setReports] = useState<AnalysisReport[]>(() => loadReports())

  const saveReport = (report: AnalysisReport) => {
    setReports((prev) => {
      const next = [report, ...prev.filter((r) => r.requestId !== report.requestId)]
      persistReports(next)
      return next
    })
  }

  return { reports, saveReport }
}

// ─── Design Helpers ───────────────────────────────────────────────────────────

function scoreTextColor(score: number, inverted = false) {
  if (inverted) {
    if (score <= 33) return 'text-emerald-500'
    if (score <= 60) return 'text-amber-500'
    return 'text-rose-500'
  }
  if (score >= 70) return 'text-emerald-500'
  if (score >= 45) return 'text-amber-500'
  return 'text-rose-500'
}

function scoreBarColor(score: number, inverted = false) {
  if (inverted) {
    if (score <= 33) return '#10b981'
    if (score <= 60) return '#f59e0b'
    return '#f43f5e'
  }
  if (score >= 70) return '#10b981'
  if (score >= 45) return '#f59e0b'
  return '#f43f5e'
}

function riskBadgeCls(level: 'low' | 'medium' | 'high') {
  return {
    low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    high: 'bg-rose-50 text-rose-700 border-rose-200',
  }[level]
}

// ─── Shared Components ────────────────────────────────────────────────────────

function ScorePill({
  recommendation,
}: {
  recommendation: AnalysisReport['scoring']['recommendation']
}) {
  const cfg =
    recommendation === 'launch'
      ? {
          label: 'Launch ready',
          cls: 'bg-emerald-500/10 border-emerald-400/25 text-emerald-600',
          dot: 'bg-emerald-400',
        }
      : recommendation === 'launch-with-caution'
        ? {
            label: 'Proceed with caution',
            cls: 'bg-amber-500/10 border-amber-400/25 text-amber-600',
            dot: 'bg-amber-400',
          }
        : {
            label: 'Do not launch',
            cls: 'bg-rose-500/10 border-rose-400/25 text-rose-600',
            dot: 'bg-rose-400',
          }

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${cfg.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

const baseCls =
  'w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:ring-2'

function inputClass(hasError: boolean) {
  return `${baseCls} ${hasError ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-400/15' : 'border-zinc-200 focus:border-violet-400 focus:ring-violet-400/15'}`
}

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-zinc-500">
        {label}
        {required && <span className="text-rose-400">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-[11px] font-medium text-rose-500">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-zinc-400">{hint}</p>
      ) : null}
    </div>
  )
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 text-xs shadow-2xl">
      {label && <p className="mb-2 font-medium text-zinc-400">{label}</p>}
      {payload.map((entry) => (
        <p
          key={entry.name}
          className="flex items-center gap-1.5 font-medium"
          style={{ color: entry.color }}
        >
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: entry.color }}
          />
          {entry.name}:{' '}
          <span className="ml-0.5 text-white">{entry.value}</span>
        </p>
      ))}
    </div>
  )
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IconOverview = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
  >
    <rect x="1" y="1" width="5.5" height="5.5" rx="1.2" />
    <rect x="8.5" y="1" width="5.5" height="5.5" rx="1.2" />
    <rect x="1" y="8.5" width="5.5" height="5.5" rx="1.2" />
    <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.2" />
  </svg>
)

const IconCharts = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
  >
    <path d="M2 12V8M5.5 12V5.5M9 12V3.5M12.5 12V1.5" />
  </svg>
)

const IconDoc = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
  >
    <path d="M3 2.5A1.5 1.5 0 014.5 1h6l3 3v8.5a1.5 1.5 0 01-1.5 1.5h-8A1.5 1.5 0 013 12.5v-10z" />
    <path d="M10.5 1v3.5H14" strokeLinecap="round" />
    <path d="M5.5 7.5h4M5.5 10h4" strokeLinecap="round" />
  </svg>
)

const IconLink = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
  >
    <path d="M5.5 9.5l4-4M6 5H3.5A2 2 0 001.5 7v1A2 2 0 003.5 10H5M9 10h2.5a2 2 0 002-2V7a2 2 0 00-2-2H10" />
  </svg>
)

const IconFeedback = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
  >
    <path d="M13 2H2a1 1 0 00-1 1v8a1 1 0 001 1h3l2 2 2-2h4a1 1 0 001-1V3a1 1 0 00-1-1z" />
    <path d="M5 6h5M5 9h3" strokeLinecap="round" />
  </svg>
)

// ─── Analysis Loading Screen ──────────────────────────────────────────────────

function AnalysisLoadingScreen({ stageIndex }: { stageIndex: number }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6">
      <div className="w-full max-w-sm text-center">
        {/* Spinner rings */}
        <div className="relative mx-auto mb-10 h-20 w-20">
          <div className="absolute inset-0 rounded-full border-2 border-violet-500/15" />
          <div
            className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-violet-500"
            style={{ animationDuration: '1s' }}
          />
          <div
            className="absolute inset-3 animate-spin rounded-full border-2 border-transparent border-t-fuchsia-400"
            style={{ animationDuration: '1.6s', animationDirection: 'reverse' }}
          />
          <div className="absolute inset-6 rounded-full bg-violet-500/10" />
        </div>

        <h2 className="text-xl font-bold text-white">Analysing your idea</h2>
        <p className="mt-2 text-sm text-zinc-500">
          AI agents are running — this takes 30–90 seconds
        </p>

        {/* Stage list */}
        <div className="mt-8 space-y-1 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-left">
          {ANALYSIS_STAGES.map((stage, i) => {
            const done = i < stageIndex
            const active = i === stageIndex
            return (
              <div
                key={stage}
                className={`flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-all duration-300 ${
                  done
                    ? 'text-zinc-600'
                    : active
                      ? 'bg-white/[0.04] font-medium text-white'
                      : 'text-zinc-700'
                }`}
              >
                {done ? (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 13 13"
                    fill="none"
                    className="shrink-0 text-emerald-500"
                  >
                    <circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeWidth="1" />
                    <path
                      d="M3.5 6.5l2 2 4-4"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : active ? (
                  <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-400" />
                ) : (
                  <span className="h-3 w-3 shrink-0 rounded-full border border-zinc-700" />
                )}
                {stage}
              </div>
            )
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-5 h-1 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-[1200ms] ease-out"
            style={{
              width: `${Math.min(((stageIndex + 0.5) / ANALYSIS_STAGES.length) * 100, 95)}%`,
            }}
          />
        </div>
        <p className="mt-2 text-[11px] text-zinc-600">
          Stage {Math.min(stageIndex + 1, ANALYSIS_STAGES.length)} of {ANALYSIS_STAGES.length}
        </p>
      </div>
    </div>
  )
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="flex items-center justify-between border-b border-white/[0.05] px-8 py-5">
        <span className="text-sm font-bold tracking-tight text-white">GoLaunch AI</span>
        <button
          className="text-xs font-medium text-zinc-500 transition-colors hover:text-white"
          onClick={() => navigate('/dashboard')}
          type="button"
        >
          Open dashboard →
        </button>
      </nav>

      <div className="relative mx-auto max-w-5xl px-8 pb-20 pt-20">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.022)_1px,transparent_1px)] bg-[size:72px_72px]" />
        <div className="glow-orb pointer-events-none absolute left-1/2 top-0 h-56 w-[520px] -translate-x-1/2 rounded-full bg-violet-600/18 blur-[110px]" />

        <div className="relative z-10">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/[0.06] px-4 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
            <span className="text-xs font-medium text-violet-400">
              AI-powered startup intelligence
            </span>
          </div>

          <h1 className="mb-6 text-[clamp(2.6rem,7vw,4.8rem)] font-bold leading-[1.04] tracking-[-0.02em] text-white">
            Know before
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
              you launch.
            </span>
          </h1>

          <p className="mb-10 max-w-[500px] text-lg leading-relaxed text-zinc-400">
            AI agents scan market signals, competitors, and execution readiness — then deliver
            investor-grade analysis in minutes.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-500/20 active:scale-[0.98]"
              onClick={() => navigate('/analysis/new')}
              type="button"
            >
              Start analysis
            </button>
            <button
              className="rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-white active:scale-[0.98]"
              onClick={() => navigate('/dashboard')}
              type="button"
            >
              View analyses
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-8 pb-24">
        <p className="mb-5 text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
          What GoLaunch delivers
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: 'Market demand signals',
              desc: 'Real-time web research synthesised into demand curves and trend signals for your target market.',
            },
            {
              title: 'Competitor landscape',
              desc: 'Saturation score, positioning gaps, and notable competitors discovered through automated research.',
            },
            {
              title: 'Execution readiness',
              desc: 'Team capacity, runway, and operational factors measured against your timeline and complexity.',
            },
            {
              title: 'Risk decomposition',
              desc: 'Multi-category risk scoring with severity levels and specific context for each dimension.',
            },
            {
              title: 'Investor narrative',
              desc: 'AI-crafted pitch-ready summary that clearly communicates your market opportunity and viability.',
            },
            {
              title: 'Action roadmap',
              desc: 'Prioritised next steps derived from gaps identified across all analysis dimensions.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:border-white/[0.10] hover:bg-white/[0.04]"
            >
              <h3 className="mb-2 text-sm font-semibold text-zinc-200">{f.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

function DashboardPage({ reportCards }: { reportCards: AnalysisReportCard[] }) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      <header className="sticky top-0 z-10 border-b border-zinc-200/60 bg-[#F8F7F4]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-4">
          <div className="flex items-center gap-5">
            <button
              className="text-sm font-bold tracking-tight text-zinc-900 transition-colors hover:text-violet-700"
              onClick={() => navigate('/')}
              type="button"
            >
              GoLaunch AI
            </button>
            <span className="h-4 w-px bg-zinc-200" />
            <span className="text-sm text-zinc-500">Analyses</span>
          </div>
          <button
            className="flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 active:scale-[0.98]"
            onClick={() => navigate('/analysis/new')}
            type="button"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 11 11"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            >
              <path d="M5.5 1v9M1 5.5h9" />
            </svg>
            New analysis
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-8 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Your analyses</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {reportCards.length === 0
              ? 'No analyses yet — run your first one to get started.'
              : `${reportCards.length} analysis${reportCards.length !== 1 ? 'es' : ''} generated`}
          </p>
        </div>

        {reportCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white py-24 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="text-zinc-400"
                strokeWidth="1.4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-zinc-900">No analyses yet</h2>
            <p className="mt-1.5 max-w-xs text-sm text-zinc-500">
              Validate your startup idea with AI-powered market intelligence and get an
              investor-ready report.
            </p>
            <button
              className="mt-6 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 active:scale-[0.98]"
              onClick={() => navigate('/analysis/new')}
              type="button"
            >
              Start your first analysis
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {reportCards.map((report) => (
              <article
                key={report.requestId}
                className="group cursor-pointer rounded-2xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-300 hover:shadow-md active:scale-[0.99]"
                onClick={() => navigate(`/analysis/${report.requestId}/overview`)}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-zinc-900">{report.productName}</h2>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                      {report.oneLiner}
                    </p>
                  </div>
                  <ScorePill recommendation={report.recommendation} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-zinc-50 p-3">
                    <p className="text-[11px] font-medium text-zinc-400">Viability</p>
                    <p className={`mt-1 text-2xl font-bold ${scoreTextColor(report.viabilityScore)}`}>
                      {report.viabilityScore}
                    </p>
                    <div className="mt-2 h-1 rounded-full bg-zinc-200">
                      <div
                        className="h-1 rounded-full"
                        style={{
                          width: `${report.viabilityScore}%`,
                          background: scoreBarColor(report.viabilityScore),
                        }}
                      />
                    </div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-3">
                    <p className="text-[11px] font-medium text-zinc-400">Risk</p>
                    <p
                      className={`mt-1 text-2xl font-bold ${scoreTextColor(report.riskScore, true)}`}
                    >
                      {report.riskScore}
                    </p>
                    <div className="mt-2 h-1 rounded-full bg-zinc-200">
                      <div
                        className="h-1 rounded-full"
                        style={{
                          width: `${report.riskScore}%`,
                          background: scoreBarColor(report.riskScore, true),
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-4">
                  <span className="text-xs text-zinc-400">
                    {new Date(report.generatedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="text-xs font-semibold text-violet-600 transition-colors group-hover:text-violet-500">
                    Open workspace →
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// ─── Wizard Page ──────────────────────────────────────────────────────────────

function WizardPage({ saveReport }: { saveReport: (report: AnalysisReport) => void }) {
  const navigate = useNavigate()
  const [form, setForm] = useState<WizardFormState>(EMPTY_FORM)
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<FormErrors>({})
  const [busy, setBusy] = useState(false)
  const [busyStage, setBusyStage] = useState(0)
  const [submitError, setSubmitError] = useState('')
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const STEPS = ['Idea basics', 'Market context', 'Execution inputs']

  function update<K extends keyof WizardFormState>(field: K, value: WizardFormState[K]) {
    setForm((f) => ({ ...f, [field]: value }))
    // Clear error on change
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function tryAdvance() {
    const errs = validateStep(step, form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setErrors({})
    setStep((s) => s + 1)
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Cycle through loading stages while API is running
  useEffect(() => {
    if (!busy) {
      setBusyStage(0)
      if (stageTimer.current) clearInterval(stageTimer.current)
      return
    }
    stageTimer.current = setInterval(() => {
      setBusyStage((s) => Math.min(s + 1, ANALYSIS_STAGES.length - 1))
    }, 5500)
    return () => {
      if (stageTimer.current) clearInterval(stageTimer.current)
    }
  }, [busy])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const errs = validateStep(2, form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setBusy(true)
    setSubmitError('')
    try {
      const report = await generateReport(toAnalysisPayload(form))
      saveReport(report)
      navigate(`/analysis/${report.requestId}/overview`)
    } catch (err) {
      setBusy(false)
      setSubmitError(err instanceof Error ? err.message : 'Failed to generate analysis.')
    }
  }

  // Show loading screen while waiting
  if (busy) return <AnalysisLoadingScreen stageIndex={busyStage} />

  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      <header className="border-b border-zinc-200/60 bg-[#F8F7F4]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-8 py-4">
          <button
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-900"
            onClick={() => navigate('/dashboard')}
            type="button"
          >
            ← Analyses
          </button>
          <span className="text-zinc-300">/</span>
          <span className="text-sm font-semibold text-zinc-900">New analysis</span>
        </div>
      </header>

      <div ref={scrollRef} className="mx-auto max-w-3xl px-8 py-10">
        {/* Step indicator */}
        <div className="mb-10 flex items-start">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-start">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${
                    i < step
                      ? 'border-violet-600 bg-violet-600 text-white'
                      : i === step
                        ? 'border-violet-500 bg-white text-violet-600'
                        : 'border-zinc-200 bg-white text-zinc-400'
                  }`}
                >
                  {i < step ? (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M1.5 5l2.5 2.5 4.5-4.5"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`mt-2 whitespace-nowrap text-xs font-medium ${i === step ? 'text-zinc-900' : 'text-zinc-400'}`}
                >
                  {s}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-3 mt-4 h-0.5 w-16 transition-colors ${i < step ? 'bg-violet-500' : 'bg-zinc-200'}`}
                />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
            {/* ── Step 0: Idea Basics ── */}
            {step === 0 && (
              <div className="space-y-5">
                <div className="mb-2">
                  <h2 className="text-lg font-bold text-zinc-900">Tell us about your idea</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    The core concept and positioning of your startup.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Product name" required error={errors.productName}>
                    <input
                      className={inputClass(!!errors.productName)}
                      placeholder="e.g. Acme Analytics"
                      value={form.productName}
                      onChange={(e) => update('productName', e.target.value)}
                      autoFocus
                    />
                  </Field>
                  <Field label="Industry" required error={errors.industry}>
                    <input
                      className={inputClass(!!errors.industry)}
                      placeholder="e.g. SaaS, FinTech, HealthTech"
                      value={form.industry}
                      onChange={(e) => update('industry', e.target.value)}
                    />
                  </Field>
                </div>
                <Field
                  label="One-liner"
                  required
                  error={errors.oneLiner}
                  hint="A single sentence that defines what your product does and for whom."
                >
                  <input
                    className={inputClass(!!errors.oneLiner)}
                    placeholder="e.g. Real-time analytics for e-commerce teams to reduce cart abandonment"
                    value={form.oneLiner}
                    onChange={(e) => update('oneLiner', e.target.value)}
                  />
                </Field>
                <Field
                  label="Target audience"
                  required
                  error={errors.targetAudience}
                  hint="Be specific — the more precise, the sharper the market research."
                >
                  <input
                    className={inputClass(!!errors.targetAudience)}
                    placeholder="e.g. Mid-market e-commerce teams with 50–500 employees"
                    value={form.targetAudience}
                    onChange={(e) => update('targetAudience', e.target.value)}
                  />
                </Field>
              </div>
            )}

            {/* ── Step 1: Market Context ── */}
            {step === 1 && (
              <div className="space-y-5">
                <div className="mb-2">
                  <h2 className="text-lg font-bold text-zinc-900">Market context</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Help our agents understand the landscape your startup operates in.
                  </p>
                </div>
                <Field
                  label="Geographies"
                  required
                  error={errors.geographies}
                  hint="Comma-separated — e.g. US, UK, India"
                >
                  <input
                    className={inputClass(!!errors.geographies)}
                    placeholder="US, EU, Southeast Asia"
                    value={form.geographies}
                    onChange={(e) => update('geographies', e.target.value)}
                    autoFocus
                  />
                </Field>
                <Field
                  label="Problem statement"
                  required
                  error={errors.problemStatement}
                  hint="Describe the specific pain point you're solving. Be concrete."
                >
                  <textarea
                    className={`${inputClass(!!errors.problemStatement)} min-h-28 resize-none`}
                    placeholder="What problem does your startup solve, and who experiences it most acutely?"
                    value={form.problemStatement}
                    onChange={(e) => update('problemStatement', e.target.value)}
                  />
                </Field>
                <Field
                  label="Proposed solution"
                  required
                  error={errors.proposedSolution}
                  hint="How does your product solve this problem differently from existing alternatives?"
                >
                  <textarea
                    className={`${inputClass(!!errors.proposedSolution)} min-h-28 resize-none`}
                    placeholder="Describe your solution approach and how it delivers value."
                    value={form.proposedSolution}
                    onChange={(e) => update('proposedSolution', e.target.value)}
                  />
                </Field>
                <Field
                  label="Key differentiators"
                  required
                  error={errors.differentiators}
                  hint="Comma-separated — what makes your approach unique or defensible?"
                >
                  <textarea
                    className={`${inputClass(!!errors.differentiators)} min-h-20 resize-none`}
                    placeholder="e.g. real-time processing, proprietary dataset, novel pricing model"
                    value={form.differentiators}
                    onChange={(e) => update('differentiators', e.target.value)}
                  />
                </Field>
                <Field
                  label="Constraints"
                  hint="Optional — comma-separated: timeline, regulatory, resource constraints, etc."
                >
                  <textarea
                    className={`${inputClass(false)} min-h-16 resize-none`}
                    placeholder="e.g. must launch in 6 months, regulated industry, bootstrapped"
                    value={form.constraints}
                    onChange={(e) => update('constraints', e.target.value)}
                  />
                </Field>
              </div>
            )}

            {/* ── Step 2: Execution Inputs ── */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="mb-2">
                  <h2 className="text-lg font-bold text-zinc-900">Execution inputs</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Operational details used to calculate readiness and risk scores.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Team size"
                    required
                    error={errors.teamSize}
                    hint="Total headcount including founders"
                  >
                    <input
                      className={inputClass(!!errors.teamSize)}
                      type="number"
                      min="1"
                      placeholder="e.g. 8"
                      value={form.teamSize}
                      onChange={(e) => update('teamSize', e.target.value)}
                      autoFocus
                    />
                  </Field>
                  <Field
                    label="Runway (months)"
                    required
                    error={errors.runwayMonths}
                    hint="How many months of capital remain?"
                  >
                    <input
                      className={inputClass(!!errors.runwayMonths)}
                      type="number"
                      min="0"
                      placeholder="e.g. 18"
                      value={form.runwayMonths}
                      onChange={(e) => update('runwayMonths', e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Budget (USD)"
                    required
                    error={errors.budgetUsd}
                    hint="Total capital available for this launch"
                  >
                    <input
                      className={inputClass(!!errors.budgetUsd)}
                      type="number"
                      min="0"
                      placeholder="e.g. 500000"
                      value={form.budgetUsd}
                      onChange={(e) => update('budgetUsd', e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Timeline (weeks)"
                    required
                    error={errors.expectedTimelineWeeks}
                    hint="Target time to launch from today"
                  >
                    <input
                      className={inputClass(!!errors.expectedTimelineWeeks)}
                      type="number"
                      min="1"
                      placeholder="e.g. 20"
                      value={form.expectedTimelineWeeks}
                      onChange={(e) => update('expectedTimelineWeeks', e.target.value)}
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Technical complexity" hint="Overall engineering difficulty">
                    <select
                      className={inputClass(false)}
                      value={form.technicalComplexity}
                      onChange={(e) =>
                        update(
                          'technicalComplexity',
                          e.target.value as WizardFormState['technicalComplexity'],
                        )
                      }
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </Field>
                  <Field
                    label="Sales readiness"
                    required
                    error={errors.salesReadiness}
                    hint="0 (not ready) → 100 (fully ready)"
                  >
                    <input
                      className={inputClass(!!errors.salesReadiness)}
                      type="number"
                      min="0"
                      max="100"
                      placeholder="0 – 100"
                      value={form.salesReadiness}
                      onChange={(e) => update('salesReadiness', e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Ops readiness"
                    required
                    error={errors.opsReadiness}
                    hint="0 (not ready) → 100 (fully ready)"
                  >
                    <input
                      className={inputClass(!!errors.opsReadiness)}
                      type="number"
                      min="0"
                      max="100"
                      placeholder="0 – 100"
                      value={form.opsReadiness}
                      onChange={(e) => update('opsReadiness', e.target.value)}
                    />
                  </Field>
                </div>

                {submitError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                    {submitError}
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="mt-8 flex items-center justify-between border-t border-zinc-100 pt-6">
              <button
                className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={step === 0}
                onClick={() => { setErrors({}); setStep((s) => s - 1) }}
                type="button"
              >
                Previous
              </button>

              {step < 2 ? (
                <button
                  className="rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 active:scale-[0.98]"
                  onClick={tryAdvance}
                  type="button"
                >
                  Continue →
                </button>
              ) : (
                <button
                  className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-violet-500 active:scale-[0.98]"
                  type="submit"
                >
                  Generate analysis →
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Analysis Workspace ───────────────────────────────────────────────────────

function AnalysisWorkspace({
  reports,
  saveReport,
}: {
  reports: AnalysisReport[]
  saveReport: (report: AnalysisReport) => void
}) {
  const { requestId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [report, setReport] = useState<AnalysisReport | null>(
    () => reports.find((r) => r.requestId === requestId) ?? null,
  )
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [loadError, setLoadError] = useState('')
  const [feedbackOutcome, setFeedbackOutcome] = useState<FeedbackPayload['outcome']>('partial')
  const [launched, setLaunched] = useState(true)
  const [feedbackNotes, setFeedbackNotes] = useState('')
  const [sendingFeedback, setSendingFeedback] = useState(false)
  const [feedbackError, setFeedbackError] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)

  useEffect(() => {
    if (report) return
    setStatus('loading')
    getReport(requestId)
      .then((fetched) => {
        setReport(fetched)
        saveReport(fetched)
        setStatus('idle')
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load report')
        setStatus('error')
      })
  }, [report, requestId, saveReport])

  const currentTab = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean)
    return parts[2] ?? 'overview'
  }, [location.pathname])

  const tabs = [
    { key: 'overview', label: 'Overview', icon: <IconOverview /> },
    { key: 'charts', label: 'Charts', icon: <IconCharts /> },
    { key: 'report', label: 'Narrative', icon: <IconDoc /> },
    { key: 'sources', label: 'Sources', icon: <IconLink /> },
    { key: 'feedback', label: 'Feedback', icon: <IconFeedback /> },
  ]

  async function handleFeedbackSubmit() {
    if (!report) return
    setSendingFeedback(true)
    setFeedbackError('')
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
      setFeedbackSent(true)
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Feedback submission failed')
    } finally {
      setSendingFeedback(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F7F4]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-violet-600/20 border-t-violet-600" />
          <p className="mt-3 text-sm text-zinc-500">Loading analysis…</p>
        </div>
      </div>
    )
  }

  if (status === 'error' || !report) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F7F4] px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f43f5e"
              strokeWidth="1.5"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-zinc-900">Analysis not found</h2>
          <p className="mt-2 max-w-xs text-sm text-zinc-500">
            {loadError || 'This report does not exist or has not been created yet.'}
          </p>
          <button
            className="mt-5 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
            onClick={() => navigate('/dashboard')}
            type="button"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  const CHART_COLORS = ['#8b5cf6', '#22d3ee', '#10b981', '#f59e0b', '#f87171']

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar ── */}
      <aside className="fixed inset-y-0 left-0 flex w-56 flex-col border-r border-white/[0.05] bg-zinc-950">
        <div className="border-b border-white/[0.05] p-4">
          <button
            className="mb-4 flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
            onClick={() => navigate('/dashboard')}
            type="button"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M8 2L4 6l4 4" />
            </svg>
            All analyses
          </button>
          <div className="rounded-xl bg-white/[0.04] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Workspace
            </p>
            <p className="mt-1.5 text-sm font-bold leading-tight text-white">
              {report.idea.productName}
            </p>
            <p className="mt-1 font-mono text-[10px] text-zinc-600">
              {report.requestId.slice(0, 12)}…
            </p>
          </div>
          <div className="mt-3">
            <ScorePill recommendation={report.scoring.recommendation} />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <div className="space-y-0.5">
            {tabs.map((tab) => (
              <NavLink
                key={tab.key}
                to={`/analysis/${report.requestId}/${tab.key}`}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-violet-500/15 text-violet-400'
                      : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300'
                  }`
                }
              >
                {tab.icon}
                {tab.label}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="border-t border-white/[0.05] p-4 space-y-2.5">
          {[
            {
              label: 'Viability',
              value: report.scoring.overallViabilityScore,
              inverted: false,
            },
            { label: 'Risk', value: report.risk.riskScore, inverted: true },
            {
              label: 'Readiness',
              value: report.readiness.readinessScore,
              inverted: false,
            },
          ].map((m) => (
            <div key={m.label}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-medium text-zinc-600">{m.label}</span>
                <span
                  className={`text-xs font-bold ${scoreTextColor(m.value, m.inverted)}`}
                >
                  {m.value}
                </span>
              </div>
              <div className="h-1 rounded-full bg-zinc-800">
                <div
                  className="h-1 rounded-full"
                  style={{
                    width: `${m.value}%`,
                    background: scoreBarColor(m.value, m.inverted),
                  }}
                />
              </div>
            </div>
          ))}
          <p className="pt-1 text-[10px] text-zinc-700">
            {new Date(report.generatedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="ml-56 min-h-screen flex-1 bg-[#F8F7F4]">
        <div className="mx-auto max-w-[860px] px-8 py-8">
          {/* Header */}
          <header className="mb-7">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
              {currentTab}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
              {report.idea.productName}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">{report.idea.oneLiner}</p>
          </header>

          {/* ═══ OVERVIEW TAB ═══ */}
          {currentTab === 'overview' && (
            <div className="space-y-5">
              {/* Score cards row */}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {report.charts.scoreBreakdown.map((item) => {
                  const inv = item.metric === 'Risk'
                  return (
                    <div
                      key={item.metric}
                      className="rounded-2xl border border-zinc-200 bg-white p-4"
                    >
                      <p className="text-xs font-medium text-zinc-500">{item.metric}</p>
                      <p
                        className={`mt-2 text-3xl font-bold ${scoreTextColor(item.score, inv)}`}
                      >
                        {item.score}
                      </p>
                      <div className="mt-3 h-1.5 rounded-full bg-zinc-100">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${item.score}%`,
                            background: scoreBarColor(item.score, inv),
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Executive summary */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Executive summary
                </h2>
                <p className="mt-3 text-sm leading-7 text-zinc-700">{report.executiveSummary}</p>
              </div>

              {/* Market + Competition */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Market demand
                  </h2>
                  <div className="mt-3 flex items-end gap-3">
                    <span
                      className={`text-4xl font-bold ${scoreTextColor(report.market.demandScore)}`}
                    >
                      {report.market.demandScore}
                    </span>
                    <div className="mb-1">
                      <p className="text-xs text-zinc-500">demand score</p>
                      <p className="text-[11px] text-zinc-400">
                        {report.market.sourceCount} sources analysed
                      </p>
                    </div>
                  </div>
                  {report.market.trendSignals.length > 0 && (
                    <div className="mt-4 space-y-2 border-t border-zinc-100 pt-4">
                      {report.market.trendSignals.slice(0, 4).map((sig) => (
                        <div key={sig} className="flex items-start gap-2 text-xs text-zinc-600">
                          <span className="mt-1.5 h-1 w-3 shrink-0 rounded-full bg-emerald-400" />
                          {sig}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Competition
                  </h2>
                  <div className="mt-3 flex items-end gap-3">
                    <span
                      className={`text-4xl font-bold ${scoreTextColor(report.competition.saturationScore, true)}`}
                    >
                      {report.competition.saturationScore}
                    </span>
                    <div className="mb-1">
                      <p className="text-xs text-zinc-500">saturation score</p>
                      <p className="text-[11px] text-zinc-400">
                        {report.competition.competitorCount} competitors found
                      </p>
                    </div>
                  </div>
                  {report.competition.notableCompetitors.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-4">
                      {report.competition.notableCompetitors.slice(0, 5).map((c) => (
                        <span
                          key={c}
                          className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Readiness + Risks */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Readiness
                  </h2>
                  <div className="mt-3 flex items-end gap-3">
                    <span
                      className={`text-4xl font-bold ${scoreTextColor(report.readiness.readinessScore)}`}
                    >
                      {report.readiness.readinessScore}
                    </span>
                    <p className="mb-1 text-xs text-zinc-500">readiness score</p>
                  </div>
                  <div className="mt-4 space-y-1.5 border-t border-zinc-100 pt-4">
                    {report.readiness.strengths.slice(0, 2).map((s) => (
                      <div key={s} className="flex items-start gap-2 text-xs text-zinc-600">
                        <span className="mt-1.5 h-1 w-3 shrink-0 rounded-full bg-emerald-400" />
                        {s}
                      </div>
                    ))}
                    {report.readiness.weakSpots.slice(0, 2).map((w) => (
                      <div key={w} className="flex items-start gap-2 text-xs text-zinc-600">
                        <span className="mt-1.5 h-1 w-3 shrink-0 rounded-full bg-rose-400" />
                        {w}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Risk breakdown
                  </h2>
                  <div className="mt-4 space-y-2.5">
                    {report.risk.categories.slice(0, 5).map((cat) => (
                      <div key={cat.category} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-zinc-700">
                            {cat.category}
                          </p>
                          {cat.reason && (
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-400">
                              {cat.reason}
                            </p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${riskBadgeCls(cat.level)}`}
                        >
                          {cat.level}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Positioning gaps */}
              {report.competition.positioningGaps.length > 0 && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Positioning opportunities
                  </h2>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {report.competition.positioningGaps.map((gap) => (
                      <div
                        key={gap}
                        className="flex items-start gap-2 rounded-xl bg-violet-50 px-3 py-2.5 text-xs text-violet-700"
                      >
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                        {gap}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Internal metrics recap */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Submitted inputs
                </h2>
                <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
                  {[
                    { label: 'Industry', value: report.idea.industry },
                    { label: 'Geographies', value: report.idea.geographies.join(', ') },
                    { label: 'Team size', value: `${report.idea.targetAudience ? '' : ''}` },
                  ]
                    .filter((x) => x.value)
                    .map((item) => (
                      <div key={item.label}>
                        <p className="text-[11px] text-zinc-400">{item.label}</p>
                        <p className="mt-0.5 text-sm font-medium text-zinc-700">{item.value}</p>
                      </div>
                    ))}
                  <div>
                    <p className="text-[11px] text-zinc-400">Industry</p>
                    <p className="mt-0.5 text-sm font-medium text-zinc-700">{report.idea.industry}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-zinc-400">Target audience</p>
                    <p className="mt-0.5 text-sm font-medium text-zinc-700">
                      {report.idea.targetAudience}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-zinc-400">Geographies</p>
                    <p className="mt-0.5 text-sm font-medium text-zinc-700">
                      {report.idea.geographies.join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ CHARTS TAB ═══ */}
          {currentTab === 'charts' && (
            <div className="space-y-5">
              <div className="grid gap-5 xl:grid-cols-2">
                {/* Radar */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                  <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Radar profile
                  </h2>
                  <p className="mb-4 text-xs text-zinc-400">
                    Scores across all analysis dimensions
                  </p>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={report.charts.radarMetrics}>
                        <PolarGrid stroke="rgba(0,0,0,0.06)" />
                        <PolarAngleAxis
                          dataKey="metric"
                          tick={{ fill: '#71717a', fontSize: 11, fontFamily: 'Plus Jakarta Sans' }}
                        />
                        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar
                          dataKey="score"
                          fill="#7c3aed"
                          fillOpacity={0.15}
                          stroke="#7c3aed"
                          strokeWidth={2}
                        />
                        <Tooltip content={<ChartTooltip />} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Score breakdown */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                  <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Score breakdown
                  </h2>
                  <p className="mb-4 text-xs text-zinc-400">Per-metric scores out of 100</p>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.charts.scoreBreakdown} barCategoryGap="38%">
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(0,0,0,0.05)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="metric"
                          tick={{ fill: '#71717a', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fill: '#71717a', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                        <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                          {report.charts.scoreBreakdown.map((item) => (
                            <Cell
                              fill={item.metric === 'Risk' ? '#f87171' : '#8b5cf6'}
                              key={item.metric}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Trend projection */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Trend projection
                </h2>
                <p className="mb-4 text-xs text-zinc-400">
                  Projected demand, competition, and risk across launch phases
                </p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={report.charts.trendProjection}>
                      <defs>
                        <linearGradient id="demandGrad" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="compGrad" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="riskGrad" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#f87171" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#f87171" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(0,0,0,0.05)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="phase"
                        tick={{ fill: '#71717a', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: '#71717a', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Area
                        dataKey="demand"
                        name="Demand"
                        fill="url(#demandGrad)"
                        stroke="#10b981"
                        strokeWidth={2}
                        type="monotone"
                        dot={false}
                      />
                      <Area
                        dataKey="competition"
                        name="Competition"
                        fill="url(#compGrad)"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        type="monotone"
                        dot={false}
                      />
                      <Area
                        dataKey="risk"
                        name="Risk"
                        fill="url(#riskGrad)"
                        stroke="#f87171"
                        strokeWidth={2}
                        type="monotone"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex items-center gap-5">
                  {[
                    { label: 'Demand', color: '#10b981' },
                    { label: 'Competition', color: '#8b5cf6' },
                    { label: 'Risk', color: '#f87171' },
                  ].map((l) => (
                    <div key={l.label} className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                      {l.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                {/* Risk distribution */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                  <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Risk distribution
                  </h2>
                  <p className="mb-4 text-xs text-zinc-400">
                    Risk score per category (higher = more risk)
                  </p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={report.charts.riskDistribution}
                        layout="vertical"
                        barCategoryGap="30%"
                      >
                        <CartesianGrid
                          horizontal={false}
                          stroke="rgba(0,0,0,0.05)"
                        />
                        <XAxis
                          domain={[0, 100]}
                          type="number"
                          tick={{ fill: '#71717a', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          dataKey="category"
                          type="category"
                          width={130}
                          tick={{ fill: '#71717a', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          content={<ChartTooltip />}
                          cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                        />
                        <Bar dataKey="score" name="Risk score" radius={[0, 6, 6, 0]}>
                          {report.charts.riskDistribution.map((item) => (
                            <Cell
                              fill={
                                item.score >= 70
                                  ? '#f87171'
                                  : item.score >= 40
                                    ? '#fbbf24'
                                    : '#10b981'
                              }
                              key={item.category}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Source distribution */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                  <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Source distribution
                  </h2>
                  <p className="mb-4 text-xs text-zinc-400">
                    Research sources by domain category
                  </p>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={report.charts.sourceDistribution}
                          dataKey="count"
                          innerRadius={55}
                          outerRadius={90}
                          nameKey="domain"
                          paddingAngle={3}
                        >
                          {report.charts.sourceDistribution.map((item, index) => (
                            <Cell
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                              key={item.domain}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {report.charts.sourceDistribution.slice(0, 5).map((item, index) => (
                      <div
                        key={item.domain}
                        className="flex items-center gap-1.5 text-xs text-zinc-500"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            background: CHART_COLORS[index % CHART_COLORS.length],
                          }}
                        />
                        {item.domain} ({item.count})
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ NARRATIVE TAB ═══ */}
          {currentTab === 'report' && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Investor narrative
                </h2>
                <p className="mt-4 text-sm leading-8 text-zinc-700">{report.investorNarrative}</p>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <h2 className="mb-5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Action plan
                </h2>
                <div className="space-y-3">
                  {report.actionPlan.map((step, index) => (
                    <div
                      key={step}
                      className="flex gap-4 rounded-xl border border-zinc-100 bg-zinc-50/50 p-4"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
                        {index + 1}
                      </span>
                      <p className="text-sm leading-6 text-zinc-700">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key differentiators recap */}
              {report.idea.differentiators.length > 0 && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                  <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Your differentiators
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {report.idea.differentiators.map((d) => (
                      <span
                        key={d}
                        className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Research evidence */}
              {(report.market.evidence.length > 0 || report.competition.evidence.length > 0) && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                  <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Research evidence
                  </h2>
                  <div className="space-y-2">
                    {[...report.market.evidence, ...report.competition.evidence]
                      .slice(0, 8)
                      .map((e, i) => (
                        <div key={i} className="flex items-start gap-3 text-sm text-zinc-600">
                          <span className="mt-2 h-1 w-3 shrink-0 rounded-full bg-violet-300" />
                          {e}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ SOURCES TAB ═══ */}
          {currentTab === 'sources' && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Research sources
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {report.rawSources.length} URLs discovered and scraped during analysis
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {report.rawSources.length === 0 ? (
                  <p className="text-sm text-zinc-400">No sources recorded for this analysis.</p>
                ) : (
                  report.rawSources.map((source, i) => {
                    let domain = source
                    try {
                      domain = new URL(source).hostname.replace('www.', '')
                    } catch {}
                    return (
                      <a
                        key={i}
                        className="group flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 px-4 py-3 transition-colors hover:border-violet-200 hover:bg-violet-50/30"
                        href={source}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <span className="shrink-0 rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                          {domain}
                        </span>
                        <span className="truncate text-xs text-zinc-600 transition-colors group-hover:text-violet-600">
                          {source}
                        </span>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          className="ml-auto shrink-0 text-zinc-300 transition-colors group-hover:text-violet-400"
                        >
                          <path d="M2 10L10 2M5 2h5v5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </a>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* ═══ FEEDBACK TAB ═══ */}
          {currentTab === 'feedback' && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Feedback loop
              </h2>
              <p className="mt-2 text-sm text-zinc-500">
                Record real-world outcomes to improve future analysis quality.
              </p>

              {feedbackSent ? (
                <div className="mt-8 flex flex-col items-center justify-center py-10 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M5 12l4 4 10-10" />
                    </svg>
                  </div>
                  <p className="text-base font-semibold text-zinc-900">Feedback submitted</p>
                  <p className="mt-1.5 max-w-xs text-sm text-zinc-500">
                    Thank you — your outcome data helps calibrate future analyses.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Did you launch?">
                      <select
                        className={inputClass(false)}
                        value={launched ? 'yes' : 'no'}
                        onChange={(e) => setLaunched(e.target.value === 'yes')}
                      >
                        <option value="yes">Yes — launched</option>
                        <option value="no">No — did not launch</option>
                      </select>
                    </Field>
                    <Field label="Outcome">
                      <select
                        className={inputClass(false)}
                        value={feedbackOutcome}
                        onChange={(e) =>
                          setFeedbackOutcome(e.target.value as FeedbackPayload['outcome'])
                        }
                      >
                        <option value="success">Success</option>
                        <option value="partial">Partial success</option>
                        <option value="failure">Failure</option>
                      </select>
                    </Field>
                  </div>
                  <Field
                    label="Notes"
                    hint="What happened? Any learnings that could help calibrate future analyses?"
                  >
                    <textarea
                      className={`${inputClass(false)} min-h-32 resize-none`}
                      placeholder="Share what worked, what didn't, and anything that surprised you…"
                      value={feedbackNotes}
                      onChange={(e) => setFeedbackNotes(e.target.value)}
                    />
                  </Field>

                  {feedbackError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                      {feedbackError}
                    </div>
                  )}

                  <button
                    className="flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 active:scale-[0.98]"
                    disabled={sendingFeedback}
                    onClick={handleFeedbackSubmit}
                    type="button"
                  >
                    {sendingFeedback ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Submitting…
                      </>
                    ) : (
                      'Submit feedback'
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ─── App Router ───────────────────────────────────────────────────────────────

function AppRouter() {
  const { reports, saveReport } = useReportsStore()
  const [health, setHealth] = useState<'checking' | 'online' | 'offline'>('checking')
  const [reportCards, setReportCards] = useState<AnalysisReportCard[]>([])

  useEffect(() => {
    listReports()
      .then(setReportCards)
      .catch(() => {
        // Fall back to locally cached cards
        setReportCards(
          reports.map((r) => ({
            requestId: r.requestId,
            generatedAt: r.generatedAt,
            productName: r.idea.productName,
            oneLiner: r.idea.oneLiner,
            recommendation: r.scoring.recommendation,
            viabilityScore: r.scoring.overallViabilityScore,
            riskScore: r.risk.riskScore,
          })),
        )
      })
  }, [reports])

  useEffect(() => {
    fetchHealth()
      .then(() => setHealth('online'))
      .catch(() => setHealth('offline'))
  }, [])

  const healthDot =
    health === 'online'
      ? 'bg-emerald-400'
      : health === 'offline'
        ? 'bg-rose-400'
        : 'bg-amber-400 animate-pulse'

  return (
    <>
      <div className="fixed right-4 top-4 z-50 flex items-center gap-1.5 rounded-full border border-white/10 bg-zinc-900/90 px-3 py-1.5 text-[11px] font-medium text-zinc-400 shadow-lg backdrop-blur-sm">
        <span className={`h-1.5 w-1.5 rounded-full ${healthDot}`} />
        API {health}
      </div>
      <Routes>
        <Route element={<LandingPage />} path="/" />
        <Route element={<DashboardPage reportCards={reportCards} />} path="/dashboard" />
        <Route element={<WizardPage saveReport={saveReport} />} path="/analysis/new" />
        <Route
          element={<AnalysisWorkspace reports={reports} saveReport={saveReport} />}
          path="/analysis/:requestId/:tab"
        />
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
