export type InternalMetrics = {
  teamSize: number
  runwayMonths: number
  budgetUsd: number
  expectedTimelineWeeks: number
  technicalComplexity: 'low' | 'medium' | 'high'
  salesReadiness: number
  opsReadiness: number
}

export type StartupIdeaInput = {
  productName: string
  oneLiner: string
  targetAudience: string
  industry: string
  geographies: string[]
  problemStatement: string
  proposedSolution: string
  differentiators: string[]
}

export type AnalysisRequest = {
  idea: StartupIdeaInput
  internalMetrics: InternalMetrics
  constraints?: string[]
}

export type MarketSignal = {
  demandScore: number
  trendSignals: string[]
  sourceCount: number
  evidence: string[]
}

export type CompetitorInsight = {
  competitorCount: number
  saturationScore: number
  notableCompetitors: string[]
  positioningGaps: string[]
  evidence: string[]
}

export type ReadinessInsight = {
  readinessScore: number
  strengths: string[]
  weakSpots: string[]
}

export type RiskInsight = {
  riskScore: number
  categories: Array<{ category: string; level: 'low' | 'medium' | 'high'; reason: string }>
  topRisks: string[]
}

export type ScoringOutput = {
  feasibilityScore: number
  marketAttractivenessScore: number
  executionRiskScore: number
  overallViabilityScore: number
  recommendation: 'launch' | 'launch-with-caution' | 'do-not-launch'
}

export type AnalysisCharts = {
  scoreBreakdown: Array<{ metric: string; score: number }>
  radarMetrics: Array<{ metric: string; score: number }>
  trendProjection: Array<{ phase: string; demand: number; competition: number; risk: number }>
  riskDistribution: Array<{ category: string; score: number }>
  sourceDistribution: Array<{ domain: string; count: number }>
}

export type AnalysisReport = {
  requestId: string
  generatedAt: string
  idea: StartupIdeaInput
  executiveSummary: string
  market: MarketSignal
  competition: CompetitorInsight
  readiness: ReadinessInsight
  risk: RiskInsight
  scoring: ScoringOutput
  charts: AnalysisCharts
  actionPlan: string[]
  investorNarrative: string
  rawSources: string[]
}

export type AnalysisReportCard = {
  requestId: string
  generatedAt: string
  productName: string
  oneLiner: string
  recommendation: ScoringOutput['recommendation']
  viabilityScore: number
  riskScore: number
}

export type FeedbackPayload = {
  requestId: string
  launched: boolean
  outcome: 'success' | 'partial' | 'failure'
  notes?: string
  correctedScores?: {
    viability?: number
    risk?: number
  }
}
