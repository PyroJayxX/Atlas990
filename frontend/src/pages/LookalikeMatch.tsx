import { useState, useCallback, useEffect, useMemo } from 'react'
import AtmosphericCard from '../components/AtmosphericCard'
import ExportModal from '../components/ExportModal'
import LeadScoringTopNav from '../components/LeadScoringTopNav'
import SidebarShell from '../components/SidebarShell'
import { downloadCsv, type CsvColumn } from '../utils/exportCsv'

// Types

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

type OrgProfile = OrgSummary & {
  program_expense_ratio: number | null
  admin_overhead_ratio:  number | null
  net_asset_margin:      number | null
  labor_cost_ratio:      number | null
  solvency_ratio:        number | null
  revenue_yoy_growth:    number | null
}

type LookalikeResult = OrgProfile & {
  rank:        number
  l2_distance: number
}

type LookalikeResponse = {
  target:     OrgProfile
  lookalikes: LookalikeResult[]
}

type OrgListResponse = {
  total: number
  orgs:  OrgSummary[]
}

// Constants

const API_BASE = 'http://localhost:8000/api/v1'
const DISPLAY_TWIN_COUNT = 6
const MAX_EXPORT_TWIN_COUNT = 20

const RATIO_LABELS: Record<string, string> = {
  program_expense_ratio: 'Program Expense Ratio',
  admin_overhead_ratio:  'Admin Overhead Ratio',
  net_asset_margin:      'Net Asset Margin',
  labor_cost_ratio:      'Labor Cost Ratio',
  solvency_ratio:        'Solvency Ratio',
  revenue_yoy_growth:    'Revenue YoY Growth',
}

const RATIO_KEYS = Object.keys(RATIO_LABELS) as (keyof OrgProfile)[]

// Formatters

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatRatio(value: number | null): string {
  if (value === null || value === undefined) return '—'
  return (value * 100).toFixed(1) + '%'
}

function formatEIN(ein: string): string {
  const clean = ein.replace('-', '').padStart(9, '0')
  return `${clean.slice(0, 2)}-${clean.slice(2)}`
}

function confidenceFromDistance(distance: number): number {
  return Math.max(20, Math.min(99, Math.round((1 - distance) * 100)))
}

async function fetchLookalikes(ein: string, k: number): Promise<LookalikeResponse> {
  const res = await fetch(`${API_BASE}/lookalike/${ein}?k=${k}`)

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.detail ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<LookalikeResponse>
}

// Sub-components

type RatioRowProps = { label: string; value: number | null }

function RatioRow({ label, value }: RatioRowProps) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-2.5 last:border-b-0">
      <span className="text-[0.68rem] uppercase tracking-[0.22em] text-[#888888]">{label}</span>
      <span className="font-mono text-sm text-white">{formatRatio(value)}</span>
    </div>
  )
}

type LookalikeCardProps = { match: LookalikeResult; index: number }

function LookalikeCard({ match, index }: LookalikeCardProps) {
  const confidence = confidenceFromDistance(match.l2_distance)

  return (
    <AtmosphericCard className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#E50914]">
            Match {index + 1}
          </p>
          <p className="mt-2 truncate text-base font-semibold text-white">{match.org_name}</p>
          <p className="mt-1 font-mono text-xs text-[#888888]">{formatEIN(match.ein)}</p>
          <p className="mt-1 text-[0.68rem] text-[#555555]">
            {match.org_city}{match.org_city && match.org_state ? ', ' : ''}{match.org_state}
            {match.org_ntee_code ? ` · ${match.org_ntee_code}` : ''} · {match.tax_prd_yr}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[#888888]">Revenue</p>
          <p className="mt-1 text-sm font-semibold text-white">{formatCurrency(match.totrevenue)}</p>
          <p className="mt-2 text-[0.65rem] uppercase tracking-[0.22em] text-[#888888]">Assets</p>
          <p className="mt-1 text-sm text-white">{formatCurrency(match.totassetsend)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-2.5 flex-1 border border-white/10 bg-white/5">
          <div
            className="h-full bg-[#E50914] shadow-[0_0_14px_rgba(229,9,20,0.4)]"
            style={{ width: `${confidence}%` }}
          />
        </div>
        <span className="min-w-[3rem] text-right text-xs uppercase tracking-[0.2em] text-[#888888]">
          {confidence}%
        </span>
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">
        <p className="mb-2 text-[0.63rem] uppercase tracking-[0.28em] text-[#555555]">
          Financial Ratios
        </p>
        {RATIO_KEYS.map((key) => (
          <RatioRow key={key} label={RATIO_LABELS[key]} value={match[key] as number | null} />
        ))}
      </div>

      <div className="mt-3 text-right">
        <span className="text-[0.63rem] uppercase tracking-[0.22em] text-[#444444]">
          L2 distance: {match.l2_distance.toFixed(6)}
        </span>
      </div>
    </AtmosphericCard>
  )
}

// Org table

type OrgTableProps = {
  orgs:      OrgSummary[]
  loading:   boolean
  onSelect:  (ein: string) => void
  activeEin: string | null
}

function OrgTable({ orgs, loading, onSelect, activeEin }: OrgTableProps) {
  const [query, setQuery] = useState<string>('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return orgs
    return orgs.filter(
      (o) =>
        o.org_name.toLowerCase().includes(q) ||
        o.ein.includes(q) ||
        (o.org_state?.toLowerCase().includes(q) ?? false) ||
        (o.org_city?.toLowerCase().includes(q) ?? false) ||
        (o.org_ntee_code?.toLowerCase().includes(q) ?? false)
    )
  }, [orgs, query])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Search input */}
      <div className="border-b border-white/10 px-5 py-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, EIN, state, city, NTEE..."
          className="w-full bg-transparent text-xs text-white placeholder-[#444444] outline-none"
        />
      </div>

      {/* Row count */}
      <div className="border-b border-white/10 px-5 py-2">
        <span className="text-[0.63rem] uppercase tracking-[0.28em] text-[#444444]">
          {loading ? 'Loading...' : `${filtered.length} of ${orgs.length} organizations`}
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] border-b border-white/10 px-5 py-2.5">
        {['Organization', 'EIN', 'Location', 'Revenue', 'Assets'].map((h) => (
          <span key={h} className="text-[0.63rem] uppercase tracking-[0.28em] text-[#444444]">
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div className="scrollbar-dark min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-[0.65rem] uppercase tracking-[0.4em] text-[#333333]">
              Loading dataset...
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm text-[#444444]">No organizations match your filter.</span>
          </div>
        ) : (
          filtered.map((org) => {
            const isActive = org.ein === activeEin
            return (
              <button
                key={org.ein}
                onClick={() => onSelect(org.ein)}
                className={`grid w-full grid-cols-[2fr_1fr_1fr_1fr_1fr] border-b border-white/5 px-5 py-3 text-left transition-colors last:border-b-0 hover:bg-[#1a1a1a] ${
                  isActive ? 'bg-[#1a0a0a] border-l-2 border-l-[#E50914]' : ''
                }`}
              >
                <span className="truncate pr-4 text-xs font-medium text-white">
                  {org.org_name}
                </span>
                <span className="font-mono text-xs text-[#888888]">
                  {formatEIN(org.ein)}
                </span>
                <span className="text-xs text-[#888888]">
                  {org.org_city && org.org_state
                    ? `${org.org_city}, ${org.org_state}`
                    : org.org_state ?? '—'}
                </span>
                <span className="text-xs text-white">
                  {formatCurrency(org.totrevenue)}
                </span>
                <span className="text-xs text-[#888888]">
                  {formatCurrency(org.totassetsend)}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

// Main page

function LookalikeMatch() {
  const [orgs, setOrgs]               = useState<OrgSummary[]>([])
  const [orgsLoading, setOrgsLoading] = useState<boolean>(true)
  const [data, setData]               = useState<LookalikeResponse | null>(null)
  const [searching, setSearching]     = useState<boolean>(false)
  const [error, setError]             = useState<string | null>(null)
  const [activeEin, setActiveEin]     = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [twinCount, setTwinCount] = useState(6)

  // Load org list on mount
  useEffect(() => {
    fetch(`${API_BASE}/organizations`)
      .then((r) => r.json())
      .then((json: OrgListResponse) => setOrgs(json.orgs))
      .catch(() => setOrgs([]))
      .finally(() => setOrgsLoading(false))
  }, [])

  const runSearch = useCallback(async (ein: string) => {
    const einClean = ein.replace(/\D/g, '').padStart(9, '0')

    setSearching(true)
    setError(null)
    setData(null)
    setActiveEin(einClean)

    try {
      const json = await fetchLookalikes(einClean, DISPLAY_TWIN_COUNT)
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.')
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (!data) {
      setExportOpen(false)
      return
    }

    setTwinCount(DISPLAY_TWIN_COUNT)
  }, [data])

  const exportCount = useMemo(() => {
    if (!data) return 0
    return Math.min(Math.max(twinCount, DISPLAY_TWIN_COUNT), MAX_EXPORT_TWIN_COUNT)
  }, [data, twinCount])

  const exportColumns: CsvColumn<LookalikeResult>[] = [
    { header: 'Rank', value: (row) => row.rank },
    { header: 'Organization', value: (row) => row.org_name },
    { header: 'EIN', value: (row) => formatEIN(row.ein) },
    { header: 'Location', value: (row) => (row.org_city && row.org_state ? `${row.org_city}, ${row.org_state}` : row.org_state ?? '—') },
    { header: 'NTEE', value: (row) => row.org_ntee_code ?? '—' },
    { header: 'Tax Year', value: (row) => row.tax_prd_yr },
    { header: 'Revenue', value: (row) => formatCurrency(row.totrevenue) },
    { header: 'Assets', value: (row) => formatCurrency(row.totassetsend) },
    { header: 'Distance', value: (row) => row.l2_distance.toFixed(6) },
  ]

  const handleExport = () => {
    if (!data) return

    void (async () => {
      try {
        const exportData = await fetchLookalikes(data.target.ein, exportCount)
        if (exportData.lookalikes.length === 0) return

        const safeName = exportData.target.org_name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
        downloadCsv(`${safeName}-twins.csv`, exportData.lookalikes, exportColumns)
        setExportOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unexpected error.')
      }
    })()
  }

  return (
    <main className="h-screen overflow-hidden bg-[#0a0a0a] text-white">
      <div className="flex h-full w-full overflow-hidden bg-[#0a0a0a]">
        <SidebarShell activeLabel="Bulk Export" />

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#0a0a0a] py-4">
          <div className="flex min-h-0 w-full flex-1 flex-col px-4 pr-5 lg:px-6 lg:pr-8">

            {/* Top nav */}
            <header className="flex items-center justify-between border border-white/10 bg-[#111111] px-6 py-4 shadow-[0_0_20px_rgba(229,9,20,0.08)]">
              <LeadScoringTopNav />

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.28em] text-[#444444]">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#E50914] shadow-[0_0_6px_rgba(229,9,20,0.8)]" />
                  {orgsLoading ? 'Loading...' : `${orgs.length} orgs indexed`}
                </div>
                <button
                  type="button"
                  onClick={() => setExportOpen(true)}
                  disabled={!data || data.lookalikes.length === 0}
                  className="border border-white/10 bg-[#E50914] px-4 py-2.5 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-white transition-colors hover:bg-[#ff1e2d] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-[#666666]"
                >
                  Export
                </button>
              </div>
            </header>

            {/* Main content */}
            <section className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden border border-white/10 bg-[#111111] shadow-[0_4px_20px_rgba(229,9,20,0.1)]">

              {/* Section header */}
              <div className="flex items-start justify-between border-b border-white/10 px-5 py-5">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#888888]">
                    {data ? `Prospects › EIN ${formatEIN(data.target.ein)}` : 'Lookalike Search Engine'}
                  </p>
                  <h1 className="mt-3 text-2xl font-black tracking-[-0.04em] text-white">
                    {data ? data.target.org_name : 'Vector Similarity Search'}
                  </h1>
                  <p className="mt-2 text-sm text-[#888888]">
                    {data
                      ? `Financial fingerprint match · Top ${DISPLAY_TWIN_COUNT} lookalike organizations`
                      : 'Select an organization from the dataset to run a similarity search'}
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  {data && (
                    <div className="text-right text-[0.68rem] uppercase tracking-[0.22em] text-[#888888]">
                      <p>Tax Period</p>
                      <p className="mt-1 text-white">{data.target.tax_prd_yr}</p>
                      <p className="mt-3">NTEE</p>
                      <p className="mt-1 text-white">{data.target.org_ntee_code ?? '—'}</p>
                    </div>
                  )}

                </div>
              </div>

              {/* Two-panel layout */}
              <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">

                {/* Left — dataset table */}
                <div className="flex min-h-0 flex-col border-r border-white/10">
                  <div className="border-b border-white/10 px-5 py-3">
                    <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#555555]">
                      Dataset · {orgs.length} Organizations
                    </p>
                  </div>
                  <OrgTable
                    orgs={orgs}
                    loading={orgsLoading}
                    onSelect={runSearch}
                    activeEin={activeEin}
                  />
                </div>

                {/* Right — results panel */}
                <div className="scrollbar-dark min-h-0 overflow-y-auto">

                  {searching && (
                    <div className="flex flex-col items-center justify-center py-32">
                      <div className="mb-4 text-[0.65rem] uppercase tracking-[0.4em] text-[#E50914]">
                        Scanning Vector Index...
                      </div>
                      <div className="h-px w-48 animate-pulse bg-[#E50914] opacity-40" />
                    </div>
                  )}

                  {error && !searching && (
                    <div className="mx-5 mt-5 border border-[#E50914]/30 bg-[#E50914]/5 px-5 py-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-[#E50914]">Error</p>
                      <p className="mt-1 text-sm text-[#888888]">{error}</p>
                    </div>
                  )}

                  {!data && !searching && !error && (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                      <div className="mb-4 text-[0.65rem] uppercase tracking-[0.4em] text-[#333333]">
                        Atlas · Vector Engine · Ready
                      </div>
                      <p className="text-sm text-[#444444]">
                        Click any organization on the left to run a similarity search
                      </p>
                    </div>
                  )}

                  {data && !searching && (
                    <div className="px-5 py-5">

                      {/* Target profile */}
                      <AtmosphericCard className="mb-5 p-6">
                        <p className="text-[0.7rem] uppercase tracking-[0.28em] text-[#888888]">
                          Target Profile
                        </p>
                        <div className="mt-5 grid gap-x-8 sm:grid-cols-3">
                          <div className="space-y-4">
                            <div>
                              <span className="block text-[0.65rem] uppercase tracking-[0.24em] text-[#888888]">Organization</span>
                              <span className="mt-1.5 block text-sm font-semibold text-white">{data.target.org_name}</span>
                            </div>
                            <div>
                              <span className="block text-[0.65rem] uppercase tracking-[0.24em] text-[#888888]">EIN</span>
                              <span className="mt-1.5 block font-mono text-sm text-white">{formatEIN(data.target.ein)}</span>
                            </div>
                            <div>
                              <span className="block text-[0.65rem] uppercase tracking-[0.24em] text-[#888888]">Location</span>
                              <span className="mt-1.5 block text-sm text-white">
                                {data.target.org_city}
                                {data.target.org_city && data.target.org_state ? ', ' : ''}
                                {data.target.org_state}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[0.65rem] uppercase tracking-[0.24em] text-[#888888]">NTEE</span>
                              <span className="mt-1.5 block text-sm text-white">{data.target.org_ntee_code ?? '—'}</span>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <span className="block text-[0.65rem] uppercase tracking-[0.24em] text-[#888888]">Total Revenue</span>
                              <span className="mt-1.5 block text-sm font-semibold text-white">{formatCurrency(data.target.totrevenue)}</span>
                            </div>
                            <div>
                              <span className="block text-[0.65rem] uppercase tracking-[0.24em] text-[#888888]">Total Assets</span>
                              <span className="mt-1.5 block text-sm text-white">{formatCurrency(data.target.totassetsend)}</span>
                            </div>
                            <div>
                              <span className="block text-[0.65rem] uppercase tracking-[0.24em] text-[#888888]">Tax Period</span>
                              <span className="mt-1.5 block text-sm text-white">{data.target.tax_prd_yr}</span>
                            </div>
                          </div>

                          <div>
                            <p className="mb-2 text-[0.63rem] uppercase tracking-[0.28em] text-[#555555]">
                              Financial Ratios
                            </p>
                            {RATIO_KEYS.map((key) => (
                              <RatioRow
                                key={key}
                                label={RATIO_LABELS[key]}
                                value={data.target[key] as number | null}
                              />
                            ))}
                          </div>
                        </div>
                      </AtmosphericCard>

                      {/* Lookalike grid */}
                      <div className="mb-3">
                        <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#555555]">
                          Top {Math.min(data.lookalikes.length, DISPLAY_TWIN_COUNT)} Lookalike Organizations
                        </p>
                      </div>

                      <div className="grid gap-4 2xl:grid-cols-2">
                        {data.lookalikes.map((match, i) => (
                          <LookalikeCard key={match.ein} match={match} index={i} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>

      <ExportModal
        open={exportOpen}
        eyebrow="Vector Export"
        title="Export similar organizations"
        description={data ? 'Choose how many twins to export from the current similarity results.' : 'Select an organization first to enable exports.'}
        onClose={() => setExportOpen(false)}
        onPrimary={handleExport}
        primaryLabel="Export CSV"
        primaryDisabled={!data}
      >
        <div className="space-y-5">
          <div className="border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-[#888888]">Query organization</p>
            <p className="mt-2 text-lg font-semibold text-white">{data?.target.org_name ?? 'No organization selected'}</p>
            <p className="mt-1 text-xs text-[#888888]">
              {data ? `EIN ${formatEIN(data.target.ein)}` : 'Run a vector similarity search to enable export.'}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[0.65rem] uppercase tracking-[0.28em] text-[#888888]">Twin count</span>
              <span className="font-mono text-sm text-white">{exportCount}</span>
            </div>
            <input
              type="range"
              min={6}
              max={20}
              step={1}
              value={Math.min(Math.max(twinCount, 6), 20)}
              onChange={(event) => setTwinCount(Number(event.target.value))}
              className="h-2 w-full cursor-pointer appearance-none bg-white/10 accent-[#E50914]"
              disabled={!data}
            />
            <label className="space-y-2">
              <span className="block text-[0.65rem] uppercase tracking-[0.28em] text-[#888888]">Manual count</span>
              <input
                type="number"
                min={6}
                max={20}
                value={Math.min(Math.max(twinCount, 6), 20)}
                onChange={(event) => setTwinCount(Number(event.target.value) || 6)}
                disabled={!data}
                className="h-11 w-full border border-white/10 bg-[#0d0d0d] px-3 text-sm text-white outline-none focus:border-[#E50914] disabled:cursor-not-allowed disabled:text-[#666666]"
              />
            </label>
          </div>

          <div className="border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-sm text-white">You are exporting {exportCount} organizations.</p>
            <p className="mt-1 text-xs text-[#888888]">
              Minimum {DISPLAY_TWIN_COUNT}, maximum {MAX_EXPORT_TWIN_COUNT}. Export downloads from the backend using your selected twin count, while the page stays capped at {DISPLAY_TWIN_COUNT} visible twins.
            </p>
          </div>
        </div>
      </ExportModal>
    </main>
  )
}

export default LookalikeMatch