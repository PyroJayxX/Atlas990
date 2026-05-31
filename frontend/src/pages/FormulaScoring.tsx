import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import AtmosphericCard from '../components/AtmosphericCard'
import SidebarShell from '../components/SidebarShell'

// Types

type ScoredOrg = {
  ein:           string
  org_name:      string
  org_state:     string | null
  org_ntee_code: string | null
  tax_prd_yr:    number
  lead_score:    number
  scorer:        string
}

type ScoreContribution = {
  feature: string
  weight:  number
  contrib: number
}

type ScoredOrgDetail = ScoredOrg & {
  contributions: ScoreContribution[]
}

type ScoreDetailResponse = {
  scorer:      string
  score_label: string
  score_note:  string
  org:         ScoredOrgDetail
}

type ScoresResponse = {
  scorer: string
  total:  number
  orgs:   ScoredOrg[]
}

// Constants

const API_BASE = 'http://localhost:8000/api/v1'

const FEATURE_LABELS: Record<string, string> = {
  program_expense_ratio: 'Program Expense Ratio',
  revenue_yoy_growth:    'Revenue YoY Growth',
  solvency_ratio:        'Solvency Ratio',
  net_asset_margin:      'Net Asset Margin',
  admin_overhead_ratio:  'Admin Overhead Ratio',
}

// Formatters

function formatEIN(ein: string): string {
  const clean = ein.replace('-', '').padStart(9, '0')
  return `${clean.slice(0, 2)}-${clean.slice(2)}`
}

function formatWeight(w: number): string {
  return w >= 0 ? `+${(w * 100).toFixed(0)}%` : `${(w * 100).toFixed(0)}%`
}

function formatContrib(c: number): string {
  return c >= 0 ? `+${c.toFixed(4)}` : c.toFixed(4)
}

function scoreColor(score: number): string {
  if (score >= 75) return '#E50914'
  if (score >= 50) return '#ff6b35'
  if (score >= 25) return '#f5a623'
  return '#888888'
}

// Org table

type OrgTableProps = {
  orgs:      ScoredOrg[]
  loading:   boolean
  onSelect:  (ein: string) => void
  activeEin: string | null
}

function OrgTable({ orgs, loading, onSelect, activeEin }: OrgTableProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return orgs
    return orgs.filter(
      (o) =>
        o.org_name.toLowerCase().includes(q) ||
        o.ein.includes(q) ||
        (o.org_state?.toLowerCase().includes(q) ?? false) ||
        (o.org_ntee_code?.toLowerCase().includes(q) ?? false)
    )
  }, [orgs, query])

  return (
    <div className="flex flex-col">
      <div className="border-b border-white/10 px-5 py-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, EIN, state, NTEE..."
          className="w-full bg-transparent text-xs text-white placeholder-[#444444] outline-none"
        />
      </div>

      <div className="border-b border-white/10 px-5 py-2">
        <span className="text-[0.63rem] uppercase tracking-[0.28em] text-[#444444]">
          {loading ? 'Loading...' : `${filtered.length} of ${orgs.length} organizations`}
        </span>
      </div>

      <div className="grid grid-cols-[2fr_1fr_1fr_0.6fr] border-b border-white/10 px-5 py-2.5">
        {['Organization', 'EIN', 'NTEE', 'Score'].map((h) => (
          <span key={h} className="text-[0.63rem] uppercase tracking-[0.28em] text-[#444444]">{h}</span>
        ))}
      </div>

      <div className="max-h-[520px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="text-[0.65rem] uppercase tracking-[0.4em] text-[#333333]">Loading scores...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm text-[#444444]">No results.</span>
          </div>
        ) : (
          filtered.map((org) => {
            const isActive = org.ein === activeEin
            return (
              <button
                key={org.ein}
                onClick={() => onSelect(org.ein)}
                className={`grid w-full grid-cols-[2fr_1fr_1fr_0.6fr] border-b border-white/5 px-5 py-3 text-left transition-colors last:border-b-0 hover:bg-[#1a1a1a] ${
                  isActive ? 'bg-[#1a0a0a] border-l-2 border-l-[#E50914]' : ''
                }`}
              >
                <span className="truncate pr-4 text-xs font-medium text-white">{org.org_name}</span>
                <span className="font-mono text-xs text-[#888888]">{formatEIN(org.ein)}</span>
                <span className="text-xs text-[#888888]">{org.org_ntee_code ?? '—'}</span>
                <span
                  className="text-xs font-bold"
                  style={{ color: scoreColor(org.lead_score) }}
                >
                  {org.lead_score.toFixed(1)}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

// Detail panel

type DetailPanelProps = {
  detail:   ScoreDetailResponse | null
  loading:  boolean
  error:    string | null
}

function DetailPanel({ detail, loading, error }: DetailPanelProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="mb-4 text-[0.65rem] uppercase tracking-[0.4em] text-[#E50914]">
          Computing Score...
        </div>
        <div className="h-px w-48 animate-pulse bg-[#E50914] opacity-40" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-5 mt-5 border border-[#E50914]/30 bg-[#E50914]/5 px-5 py-4">
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-[#E50914]">Error</p>
        <p className="mt-1 text-sm text-[#888888]">{error}</p>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="mb-4 text-[0.65rem] uppercase tracking-[0.4em] text-[#333333]">
          Atlas · Formula Engine · Ready
        </div>
        <p className="text-sm text-[#444444]">Select an organization to view its priority score</p>
      </div>
    )
  }

  const { org, score_note } = detail
  const color = scoreColor(org.lead_score)

  return (
    <div className="px-5 py-5">
      {/* Score card */}
      <AtmosphericCard className="mb-5 p-6">
        <p className="text-[0.7rem] uppercase tracking-[0.28em] text-[#888888]">
          Rules-Based Priority Score
        </p>

        <div className="mt-6 grid gap-x-8 sm:grid-cols-2">
          {/* Score display */}
          <div>
            <div className="flex items-end gap-3">
              <span
                className="text-[7rem] font-black leading-none"
                style={{
                  color,
                  textShadow: `0 0 40px ${color}99`,
                }}
              >
                {org.lead_score.toFixed(0)}
              </span>
              <span className="pb-4 text-sm uppercase tracking-[0.22em] text-[#888888]">/ 100</span>
            </div>

            <div className="mt-4 h-1.5 w-full bg-white/10">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${org.lead_score}%`,
                  background: color,
                  boxShadow: `0 0 18px ${color}77`,
                }}
              />
            </div>

            <div className="mt-5 space-y-2">
              <div>
                <span className="text-[0.65rem] uppercase tracking-[0.24em] text-[#888888]">Organization</span>
                <p className="mt-1 text-sm font-semibold text-white">{org.org_name}</p>
              </div>
              <div>
                <span className="text-[0.65rem] uppercase tracking-[0.24em] text-[#888888]">EIN</span>
                <p className="mt-1 font-mono text-sm text-white">{formatEIN(org.ein)}</p>
              </div>
              <div>
                <span className="text-[0.65rem] uppercase tracking-[0.24em] text-[#888888]">State · NTEE · Year</span>
                <p className="mt-1 text-sm text-white">
                  {org.org_state ?? '—'} · {org.org_ntee_code ?? '—'} · {org.tax_prd_yr}
                </p>
              </div>
            </div>
          </div>

          {/* Contribution breakdown */}
          <div>
            <p className="mb-3 text-[0.65rem] uppercase tracking-[0.28em] text-[#555555]">
              Score Contributions
            </p>
            <div className="space-y-0">
              {org.contributions.map((c) => (
                <div
                  key={c.feature}
                  className="flex items-center justify-between border-b border-white/5 py-2.5 last:border-b-0"
                >
                  <div>
                    <p className="text-[0.68rem] uppercase tracking-[0.2em] text-[#888888]">
                      {FEATURE_LABELS[c.feature] ?? c.feature}
                    </p>
                    <p className="mt-0.5 text-[0.63rem] text-[#444444]">
                      Weight {formatWeight(c.weight)}
                    </p>
                  </div>
                  <span
                    className="font-mono text-xs"
                    style={{ color: c.contrib >= 0 ? '#4ade80' : '#f87171' }}
                  >
                    {formatContrib(c.contrib)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="text-[0.63rem] leading-relaxed text-[#444444]">{score_note}</p>
        </div>
      </AtmosphericCard>
    </div>
  )
}

// Main page

function FormulaScoring() {
  const [orgs, setOrgs]         = useState<ScoredOrg[]>([])
  const [orgsLoading, setOrgsLoading] = useState(true)
  const [detail, setDetail]     = useState<ScoreDetailResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [activeEin, setActiveEin] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/scores/formula`)
      .then((r) => r.json())
      .then((json: ScoresResponse) => setOrgs(json.orgs))
      .catch(() => setOrgs([]))
      .finally(() => setOrgsLoading(false))
  }, [])

  const handleSelect = useCallback(async (ein: string) => {
    setActiveEin(ein)
    setDetailLoading(true)
    setError(null)
    setDetail(null)

    try {
      const res = await fetch(`${API_BASE}/scores/formula/${ein}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.detail ?? `HTTP ${res.status}`)
      }
      const json: ScoreDetailResponse = await res.json()
      setDetail(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="flex min-h-screen w-full bg-[#0a0a0a]">
        <SidebarShell activeLabel="Formula Score" />

        <section className="flex min-w-0 flex-1 flex-col bg-[#0a0a0a] py-4">
          <div className="flex flex-1 flex-col w-full px-4 pr-5 lg:px-6 lg:pr-8">

            <header className="flex items-center justify-between border border-white/10 bg-[#111111] px-6 py-4 shadow-[0_0_20px_rgba(229,9,20,0.08)]">
              <nav className="flex items-center gap-8 text-[0.72rem] uppercase tracking-[0.3em] text-[#888888]">
                <Link className="transition-colors hover:text-white" to="/">Dashboard</Link>
                <span className="text-white">Formula Score</span>
                <Link className="transition-colors hover:text-white" to="/lead-scoring/model">ML Score</Link>
                <Link className="transition-colors hover:text-white" to="/lookalike-match">Lookalike</Link>
              </nav>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.28em] text-[#444444]">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#E50914] shadow-[0_0_6px_rgba(229,9,20,0.8)]" />
                  {orgsLoading ? 'Loading...' : `${orgs.length} orgs scored`}
                </div>
                <button className="border border-white/10 bg-[#E50914] px-4 py-2.5 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-white">
                  Export
                </button>
              </div>
            </header>

            <section className="mt-4 flex-1 border border-white/10 bg-[#111111] shadow-[0_4px_20px_rgba(229,9,20,0.1)]">
              <div className="flex items-start justify-between border-b border-white/10 px-5 py-5">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#888888]">
                    Lead Intelligence · Rules-Based Engine
                  </p>
                  <h1 className="mt-3 text-2xl font-black tracking-[-0.04em] text-white">
                    Formula Score
                  </h1>
                  <p className="mt-2 text-sm text-[#888888]">
                    Deterministic weighted scoring across 5 financial ratios · Designed for interpretability and quick prioritization
                  </p>
                </div>
                <div className="text-right text-[0.68rem] uppercase tracking-[0.22em] text-[#888888]">
                  <p>Scorer</p>
                  <p className="mt-1 text-white">Rules-Based</p>
                  <p className="mt-3">Dataset</p>
                  <p className="mt-1 text-white">{orgs.length} Orgs</p>
                </div>
              </div>

              <div className="grid h-full grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                <div className="border-r border-white/10">
                  <div className="border-b border-white/10 px-5 py-3">
                    <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#555555]">
                      Ranked by Priority Score
                    </p>
                  </div>
                  <OrgTable
                    orgs={orgs}
                    loading={orgsLoading}
                    onSelect={handleSelect}
                    activeEin={activeEin}
                  />
                </div>

                <div className="overflow-y-auto">
                  <DetailPanel
                    detail={detail}
                    loading={detailLoading}
                    error={error}
                  />
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}

export default FormulaScoring