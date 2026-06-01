import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AtmosphericCard from '../components/AtmosphericCard'
import ExportModal from '../components/ExportModal'
import LeadScoringTopNav from '../components/LeadScoringTopNav'
import SidebarShell from '../components/SidebarShell'
import { downloadCsv, type CsvColumn } from '../utils/exportCsv'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrgSummary = {
  ein:           string
  org_name:      string
  org_state:     string | null
  org_city:      string | null
  org_ntee_code: string | null
  tax_prd_yr:    number
  totrevenue:    number | null
  totassetsend:  number | null
}

type ScoredOrg = {
  ein:        string
  org_name:   string
  lead_score: number
}

type OrgExportRow = OrgSummary & {
  lead_score: number | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1'

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

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

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function Dashboard() {
  const navigate = useNavigate()

  const [orgs, setOrgs]             = useState<OrgSummary[]>([])
  const [scores, setScores]         = useState<ScoredOrg[]>([])
  const [loading, setLoading]       = useState(true)
  const [query, setQuery]           = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const [exportStart, setExportStart] = useState(1)
  const [exportEnd, setExportEnd] = useState(20)

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/organizations`).then((r) => r.json()),
      fetch(`${API_BASE}/scores/formula`).then((r) => r.json()),
    ])
      .then(([orgData, scoreData]) => {
        setOrgs(orgData.orgs ?? [])
        setScores(scoreData.orgs ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Build score lookup map
  const scoreLookup = useMemo(() => {
    const map: Record<string, number> = {}
    scores.forEach((s) => { map[s.ein] = s.lead_score })
    return map
  }, [scores])

  // Aggregate metrics
  const totalRevenue = useMemo(
    () => orgs.reduce((sum, o) => sum + (o.totrevenue ?? 0), 0),
    [orgs]
  )

  const topScore = useMemo(
    () => scores.length > 0 ? Math.max(...scores.map((s) => s.lead_score)) : 0,
    [scores]
  )

  const topScoreOrg = useMemo(
    () => scores.find((s) => s.lead_score === topScore),
    [scores, topScore]
  )

  const highPriorityCount = useMemo(
    () => scores.filter((s) => s.lead_score >= 75).length,
    [scores]
  )

  // Filtered table rows — merge score into org
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return orgs
      .filter((o) =>
        !q ||
        o.org_name.toLowerCase().includes(q) ||
        o.ein.includes(q) ||
        (o.org_state?.toLowerCase().includes(q) ?? false) ||
        (o.org_city?.toLowerCase().includes(q) ?? false) ||
        (o.org_ntee_code?.toLowerCase().includes(q) ?? false)
      )
      .map((o) => ({ ...o, lead_score: scoreLookup[o.ein] ?? null }))
      .sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0))
  }, [orgs, query, scoreLookup])

  useEffect(() => {
    if (!exportOpen) return

    const maxEnd = Math.max(1, Math.min(20, filtered.length))
    setExportStart(1)
    setExportEnd(maxEnd)
  }, [exportOpen, filtered.length])

  const previewRows = useMemo(() => {
    if (filtered.length === 0) return []

    const startIndex = Math.max(0, Math.min(filtered.length - 1, exportStart - 1))
    const endIndex = Math.max(startIndex, Math.min(filtered.length - 1, exportEnd - 1))
    return filtered.slice(startIndex, endIndex + 1)
  }, [filtered, exportStart, exportEnd])

  const exportColumns: CsvColumn<OrgExportRow>[] = [
    { header: 'EIN', value: (row) => formatEIN(row.ein) },
    { header: 'Organization', value: (row) => row.org_name },
    { header: 'Location', value: (row) => (row.org_city && row.org_state ? `${row.org_city}, ${row.org_state}` : row.org_state ?? '—') },
    { header: 'NTEE', value: (row) => row.org_ntee_code ?? '—' },
    { header: 'Revenue', value: (row) => formatCurrency(row.totrevenue) },
    { header: 'Assets', value: (row) => formatCurrency(row.totassetsend) },
    { header: 'Score', value: (row) => (row.lead_score !== null ? row.lead_score.toFixed(1) : '—') },
  ]

  const handleExport = () => {
    if (previewRows.length === 0) return

    downloadCsv('atlas-overview-export.csv', previewRows, exportColumns)
    setExportOpen(false)
  }

  return (
    <main className="h-screen overflow-hidden bg-[#0a0a0a] text-white">
      <div className="flex h-full w-full overflow-hidden bg-[#0a0a0a]">
        <SidebarShell activeLabel="Overview" />

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#0a0a0a] py-4">
          <div className="flex min-h-0 w-full flex-1 flex-col px-4 pr-5 lg:px-6 lg:pr-8">

            {/* Top nav */}
            <header className="flex items-center justify-between border border-white/10 bg-[#111111] px-6 py-4 shadow-[0_0_20px_rgba(229,9,20,0.08)]">
              <LeadScoringTopNav />

              <div className="flex items-center gap-4">
                <div className="flex items-center border border-white/10 bg-[#101010]">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search registry..."
                    className="h-9 w-[260px] bg-transparent px-3 text-xs text-white placeholder-[#555555] outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setExportOpen(true)}
                  className="border border-white/10 bg-[#E50914] px-4 py-2.5 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-white transition-colors hover:bg-[#ff1e2d]"
                >
                  Export
                </button>
              </div>
            </header>

            {/* Summary cards */}
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <AtmosphericCard className="px-5 py-4">
                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#888888]">
                  Aggregate Market Value
                </p>
                <div className="mt-4 text-4xl font-black tracking-[-0.06em] text-white">
                  {loading ? '—' : formatCurrency(totalRevenue)}
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.22em] text-[#888888]">
                  Total revenue across {orgs.length} indexed organizations
                </p>
              </AtmosphericCard>

              <AtmosphericCard className="px-5 py-4">
                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#888888]">
                  High Priority Leads
                </p>
                <div className="mt-4 text-4xl font-black tracking-[-0.06em] text-[#E50914]"
                  style={{ textShadow: '0 0 30px rgba(229,9,20,0.5)' }}>
                  {loading ? '—' : highPriorityCount}
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.22em] text-[#888888]">
                  Organizations scoring above 75 · Formula engine
                </p>
              </AtmosphericCard>

              <AtmosphericCard className="px-5 py-4">
                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#888888]">
                  Top Lead Score
                </p>
                <div className="mt-4 text-4xl font-black tracking-[-0.06em] text-white">
                  {loading ? '—' : `${topScore.toFixed(1)}`}
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.22em] text-[#888888]">
                  {topScoreOrg ? topScoreOrg.org_name : '—'}
                </p>
              </AtmosphericCard>
            </div>

            {/* Registry table */}
            <section className="mt-5 flex-1 flex flex-col border border-white/10 bg-[#111111] shadow-[0_4px_20px_rgba(229,9,20,0.1)] min-h-0">
              <div className="flex items-end justify-between border-b border-white/10 px-5 py-5">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#888888]">
                    IRS 990 · ProPublica Extract
                  </p>
                  <h1 className="mt-3 text-2xl font-black tracking-[-0.04em] text-white">
                    Global Registry
                  </h1>
                  <p className="mt-2 text-sm text-[#888888]">
                    {loading ? 'Loading...' : `${filtered.length} of ${orgs.length} organizations · Sorted by lead score`}
                  </p>
                </div>
                <div className="text-right text-[0.68rem] uppercase tracking-[0.22em] text-[#888888]">
                  <p>Data Source</p>
                  <p className="mt-1 text-white">ProPublica API v2</p>
                  <p className="mt-3">Coverage</p>
                  <p className="mt-1 text-white">2011 – 2024</p>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto scrollbar-dark">
                <table className="min-w-[1000px] w-full border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-[0.65rem] uppercase tracking-[0.28em] text-[#888888]">
                      <th className="px-5 py-4 font-semibold">EIN</th>
                      <th className="px-5 py-4 font-semibold">Organization</th>
                      <th className="px-5 py-4 font-semibold">Location</th>
                      <th className="px-5 py-4 font-semibold">NTEE</th>
                      <th className="px-5 py-4 font-semibold">Revenue</th>
                      <th className="px-5 py-4 font-semibold">Assets</th>
                      <th className="px-5 py-4 font-semibold">Score</th>
                      <th className="px-5 py-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-5 py-16 text-center text-[0.65rem] uppercase tracking-[0.4em] text-[#333333]">
                          Loading registry...
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-5 py-16 text-center text-sm text-[#444444]">
                          No organizations match your search.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((row) => (
                        <tr
                          key={row.ein}
                          className="border-b border-white/5 bg-[#101010] text-sm transition-colors hover:bg-[#151515]"
                        >
                          <td className="px-5 py-4 font-mono text-xs text-[#888888]">
                            {formatEIN(row.ein)}
                          </td>
                          <td className="px-5 py-4 max-w-[220px]">
                            <span className="block truncate text-white">{row.org_name}</span>
                          </td>
                          <td className="px-5 py-4 text-xs text-[#888888]">
                            {row.org_city && row.org_state
                              ? `${row.org_city}, ${row.org_state}`
                              : row.org_state ?? '—'}
                          </td>
                          <td className="px-5 py-4 text-xs text-[#888888]">
                            {row.org_ntee_code ?? '—'}
                          </td>
                          <td className="px-5 py-4 text-xs text-white">
                            {formatCurrency(row.totrevenue)}
                          </td>
                          <td className="px-5 py-4 text-xs text-[#888888]">
                            {formatCurrency(row.totassetsend)}
                          </td>
                          <td className="px-5 py-4">
                            {row.lead_score !== null ? (
                              <span
                                className="text-xs font-bold"
                                style={{ color: scoreColor(row.lead_score) }}
                              >
                                {row.lead_score.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-xs text-[#444444]">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-4 text-[0.68rem] uppercase tracking-[0.22em]">
                              <button
                                onClick={() => navigate(`/lead-scoring/formula`)}
                                className="text-[#E50914] transition-colors hover:text-white"
                              >
                                Score
                              </button>
                              <button
                                onClick={() => navigate(`/lookalike-match`)}
                                className="text-[#E50914] transition-colors hover:text-white"
                              >
                                Lookalike
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </section>
      </div>

      <ExportModal
        open={exportOpen}
        eyebrow="Overview Export"
        title="Export selected registry rows"
        description="Choose a row range from the current table order and download a CSV export."
        onClose={() => setExportOpen(false)}
        onPrimary={handleExport}
        primaryLabel="Export CSV"
        primaryDisabled={previewRows.length === 0}
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-[0.65rem] uppercase tracking-[0.28em] text-[#888888]">Start row</span>
              <input
                type="number"
                min={1}
                max={Math.max(1, filtered.length)}
                value={exportStart}
                onChange={(event) => setExportStart(Number(event.target.value) || 1)}
                className="h-11 w-full border border-white/10 bg-[#0d0d0d] px-3 text-sm text-white outline-none focus:border-[#E50914]"
              />
            </label>

            <label className="space-y-2">
              <span className="block text-[0.65rem] uppercase tracking-[0.28em] text-[#888888]">End row</span>
              <input
                type="number"
                min={1}
                max={Math.max(1, filtered.length)}
                value={exportEnd}
                onChange={(event) => setExportEnd(Number(event.target.value) || 1)}
                className="h-11 w-full border border-white/10 bg-[#0d0d0d] px-3 text-sm text-white outline-none focus:border-[#E50914]"
              />
            </label>
          </div>

          <div className="border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-sm text-white">You are exporting {previewRows.length} organizations.</p>
            <p className="mt-1 text-xs text-[#888888]">
              Current selection: {exportStart}–{Math.max(exportStart, exportEnd)} of {filtered.length} visible rows
            </p>
          </div>
        </div>
      </ExportModal>
    </main>
  )
}

export default Dashboard