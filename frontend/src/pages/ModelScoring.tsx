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
  org:         ScoredOrgDetail
}

type ScoresResponse = {
  scorer: string
  total:  number
  orgs:   ScoredOrg[]
}

// Constants

const API_BASE = 'http://localhost:8000/api/v1'

// Formatters

function formatEIN(ein: string): string {
  const clean = ein.replace('-', '').padStart(9, '0')
  return `${clean.slice(0, 2)}-${clean.slice(2)}`
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
    <div className="flex min-h-0 flex-1 flex-col">
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

      <div className="scrollbar-dark min-h-0 flex-1 overflow-y-auto">
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
  detail:  ScoreDetailResponse | null
  loading: boolean
  error:   string | null
}

function DetailPanel({ detail, loading, error }: DetailPanelProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="mb-4 text-[0.65rem] uppercase tracking-[0.4em] text-[#E50914]">
          Running Inference...
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
          Atlas · XGBoost Engine · Ready
        </div>
        <p className="text-sm text-[#444444]">Select an organization to run model inference</p>
      </div>
    )
  }

  const { org } = detail
  const color = scoreColor(org.lead_score)

  // Sort contributions by absolute importance descending
  const sortedContribs = [...org.contributions].sort(
    (a, b) => Math.abs(b.contrib) - Math.abs(a.contrib)
  )

  return (
    <div className="px-5 py-5">
      <AtmosphericCard className="mb-5 p-6">
        <div className="flex items-center justify-between">
          <p className="text-[0.7rem] uppercase tracking-[0.28em] text-[#888888]">
            XGBoost ML Score
          </p>
          <span className="border border-[#E50914]/30 bg-[#E50914]/10 px-2 py-1 text-[0.6rem] uppercase tracking-[0.22em] text-[#E50914]">
            XGBoost · R² 0.947
          </span>
        </div>

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

          {/* Feature importance */}
          <div>
            <p className="mb-3 text-[0.65rem] uppercase tracking-[0.28em] text-[#555555]">
              Feature Importance
            </p>
            <div className="space-y-0">
              {sortedContribs.map((c) => {
                const maxContrib = Math.max(...sortedContribs.map((x) => Math.abs(x.contrib)))
                const barWidth = maxContrib > 0 ? (Math.abs(c.contrib) / maxContrib) * 100 : 0
                return (
                  <div key={c.feature} className="border-b border-white/5 py-3 last:border-b-0">
                    <div className="flex items-center justify-between">
                      <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[#888888]">
                        {c.feature.replace(/_/g, ' ')}
                      </p>
                      <span className="font-mono text-[0.65rem] text-[#555555]">
                        {(c.weight * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 w-full bg-white/5">
                      <div
                        className="h-full bg-[#E50914] opacity-70"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Model metadata */}
        <div className="mt-5 border-t border-white/10 pt-4 flex gap-8">
          <div>
            <span className="text-[0.63rem] uppercase tracking-[0.22em] text-[#444444]">Algorithm</span>
            <p className="mt-1 text-[0.68rem] text-[#666666]">XGBoost Regressor</p>
          </div>
          <div>
            <span className="text-[0.63rem] uppercase tracking-[0.22em] text-[#444444]">Estimators</span>
            <p className="mt-1 text-[0.68rem] text-[#666666]">200 trees</p>
          </div>
          <div>
            <span className="text-[0.63rem] uppercase tracking-[0.22em] text-[#444444]">MAE</span>
            <p className="mt-1 text-[0.68rem] text-[#666666]">2.45 pts</p>
          </div>
          <div>
            <span className="text-[0.63rem] uppercase tracking-[0.22em] text-[#444444]">R²</span>
            <p className="mt-1 text-[0.68rem] text-[#666666]">0.9471</p>
          </div>
        </div>
      </AtmosphericCard>
    </div>
  )
}

// Main page

function ModelScoring() {
  const [orgs, setOrgs]               = useState<ScoredOrg[]>([])
  const [orgsLoading, setOrgsLoading] = useState(true)
  const [detail, setDetail]           = useState<ScoreDetailResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [activeEin, setActiveEin]     = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/scores/model`)
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
      const res = await fetch(`${API_BASE}/scores/model/${ein}`)
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
    <main className="h-screen overflow-hidden bg-[#0a0a0a] text-white">
      <div className="flex h-full w-full overflow-hidden bg-[#0a0a0a]">
        <SidebarShell activeLabel="ML Score" />

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#0a0a0a] py-4">
          <div className="flex min-h-0 w-full flex-1 flex-col px-4 pr-5 lg:px-6 lg:pr-8">

            <header className="flex items-center justify-between border border-white/10 bg-[#111111] px-6 py-4 shadow-[0_0_20px_rgba(229,9,20,0.08)]">
              <nav className="flex items-center gap-8 text-[0.72rem] uppercase tracking-[0.3em] text-[#888888]">
                <Link className="transition-colors hover:text-white" to="/">Dashboard</Link>
                <Link className="transition-colors hover:text-white" to="/lead-scoring/formula">Formula Score</Link>
                <span className="text-white">ML Score</span>
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

            <section className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden border border-white/10 bg-[#111111] shadow-[0_4px_20px_rgba(229,9,20,0.1)]">
              <div className="flex items-start justify-between border-b border-white/10 px-5 py-5">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#888888]">
                    Lead Intelligence · XGBoost Engine
                  </p>
                  <h1 className="mt-3 text-2xl font-black tracking-[-0.04em] text-white">
                    ML Score
                  </h1>
                  <p className="mt-2 text-sm text-[#888888]">
                    Gradient boosted decision tree regressor · 200 estimators · MAE 2.45
                  </p>
                </div>
                <div className="text-right text-[0.68rem] uppercase tracking-[0.22em] text-[#888888]">
                  <p>Scorer</p>
                  <p className="mt-1 text-white">XGBoost</p>
                  <p className="mt-3">MAE</p>
                  <p className="mt-1 text-white">2.45 pts</p>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                <div className="flex min-h-0 flex-col border-r border-white/10">
                  <div className="border-b border-white/10 px-5 py-3">
                    <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#555555]">
                      Ranked by ML Score
                    </p>
                  </div>
                  <OrgTable
                    orgs={orgs}
                    loading={orgsLoading}
                    onSelect={handleSelect}
                    activeEin={activeEin}
                  />
                </div>

                <div className="scrollbar-dark min-h-0 overflow-y-auto">
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

export default ModelScoring