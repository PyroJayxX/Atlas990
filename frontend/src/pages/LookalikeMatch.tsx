import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AtmosphericCard from '../components/AtmosphericCard'
import SidebarShell from '../components/SidebarShell'

type OrganizationProfile = {
  ein: string
  organizationName: string
  state: string
  revenue: number
  assets: number
  sector: string
}

type LookalikeRecord = {
  ein: string
  organizationName: string
  revenue: number
  assets: number
  distance: number
}

type MatchEnvelope = {
  target: OrganizationProfile
  lookalikes: LookalikeRecord[]
}

const mockMatches: MatchEnvelope = {
  target: {
    ein: '23-1109223',
    organizationName: 'Advanced Medical Research Inst.',
    state: 'MA',
    revenue: 158400000,
    assets: 11000000,
    sector: 'Health Research',
  },
  lookalikes: [
    {
      ein: '13-2874925',
      organizationName: 'Global Conservation Fund',
      revenue: 1420000000,
      assets: 620000000,
      distance: 0.0412,
    },
    {
      ein: '36-1456656',
      organizationName: 'Children First Education',
      revenue: 215000000,
      assets: 91000000,
      distance: 0.0528,
    },
    {
      ein: '45-9958776',
      organizationName: 'Urban Housing Initiative',
      revenue: 68000000,
      assets: 31000000,
      distance: 0.0609,
    },
    {
      ein: '12-8778635',
      organizationName: 'Oceanic Preservation Trust',
      revenue: 93000000,
      assets: 44000000,
      distance: 0.0744,
    },
    {
      ein: '36-1123394',
      organizationName: 'Metropolitan Arts Council',
      revenue: 12000000,
      assets: 8000000,
      distance: 0.0917,
    },
  ],
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function confidenceFromDistance(distance: number): number {
  return Math.max(20, Math.min(100, Math.round((1 - distance) * 100)))
}

function LookalikeMatch() {
  const { ein = mockMatches.target.ein } = useParams<{ ein: string }>()
  const [record] = useState<MatchEnvelope>(mockMatches)

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="flex min-h-screen w-full bg-[#0a0a0a]">
        <SidebarShell activeLabel="Bulk Export" />

        <section className="flex min-w-0 flex-1 flex-col bg-[#0a0a0a] py-4">
          <div className="flex flex-1 flex-col w-full px-4 pr-5 lg:px-6 lg:pr-8">
            <header className="flex items-center justify-between border border-white/10 bg-[#111111] px-6 py-4 shadow-[0_0_20px_rgba(229,9,20,0.08)]">
              <nav className="flex items-center gap-8 text-[0.72rem] uppercase tracking-[0.3em] text-[#888888]">
                <Link className="transition-colors hover:text-white" to="/">
                  Dashboard
                </Link>
                <Link className="transition-colors hover:text-white" to={`/lead-scoring/${ein}`}>
                  Leads
                </Link>
                <span className="text-white">Segments</span>
                <span className="transition-colors hover:text-white">Analytics</span>
              </nav>

              <div className="flex items-center gap-4">
                <div className="flex h-9 w-[300px] items-center border border-white/10 bg-[#101010] px-3 text-xs text-[#888888]">
                  Search EIN...
                </div>
                <div className="h-4 w-4 rounded-full border border-white/20" />
                <div className="h-4 w-4 rounded-full border border-white/20" />
                <button className="border border-white/10 bg-[#E50914] px-4 py-2.5 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-white">
                  Add Lead
                </button>
              </div>
            </header>

            <section className="mt-4 flex-1 border border-white/10 bg-[#111111] shadow-[0_4px_20px_rgba(229,9,20,0.1)]">
              <div className="flex items-start justify-between border-b border-white/10 px-5 py-5">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#888888]">
                    Prospects &gt; EIN {ein}
                  </p>
                  <h1 className="mt-3 text-2xl font-black tracking-[-0.04em] text-white">
                    {record.target.organizationName}
                  </h1>
                  <p className="mt-2 text-sm text-[#888888]">
                    Internal Lead Intelligence Assessment &amp; Forecast
                  </p>
                </div>
                <div className="text-right text-[0.68rem] uppercase tracking-[0.22em] text-[#888888]">
                  <p>Last crawled</p>
                  <p className="mt-1 text-white">2023.10.27 / 14:42 GMT</p>
                </div>
              </div>

              <div className="grid gap-4 px-5 py-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <AtmosphericCard className="p-6">
                <p className="text-[0.7rem] uppercase tracking-[0.28em] text-[#888888]">
                  Target profile
                </p>

                <div className="mt-6 grid gap-4 text-sm text-white sm:grid-cols-2">
                  <div>
                    <span className="block text-[0.68rem] uppercase tracking-[0.24em] text-[#888888]">
                      EIN
                    </span>
                    <span className="mt-2 block font-mono text-white">{record.target.ein}</span>
                  </div>
                  <div>
                    <span className="block text-[0.68rem] uppercase tracking-[0.24em] text-[#888888]">
                      State
                    </span>
                    <span className="mt-2 block text-white">{record.target.state}</span>
                  </div>
                  <div>
                    <span className="block text-[0.68rem] uppercase tracking-[0.24em] text-[#888888]">
                      Revenue
                    </span>
                    <span className="mt-2 block text-white">{formatCurrency(record.target.revenue)}</span>
                  </div>
                  <div>
                    <span className="block text-[0.68rem] uppercase tracking-[0.24em] text-[#888888]">
                      Assets
                    </span>
                    <span className="mt-2 block text-white">{formatCurrency(record.target.assets)}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="block text-[0.68rem] uppercase tracking-[0.24em] text-[#888888]">
                      Sector
                    </span>
                    <span className="mt-2 block text-white">{record.target.sector}</span>
                  </div>
                </div>
              </AtmosphericCard>

              <AtmosphericCard className="p-6">
                <p className="text-[0.7rem] uppercase tracking-[0.28em] text-[#888888]">
                  Match confidence
                </p>
                <div className="mt-5 space-y-4">
                  {record.lookalikes.map((match, index) => {
                    const confidence = confidenceFromDistance(match.distance)
                    return (
                      <div key={match.ein} className="border-b border-white/10 pb-4 last:border-b-0 last:pb-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[0.68rem] uppercase tracking-[0.24em] text-[#E50914]">
                              Match {index + 1}
                            </p>
                            <p className="mt-2 text-base font-semibold text-white">{match.organizationName}</p>
                            <p className="mt-1 font-mono text-xs text-[#888888]">{match.ein}</p>
                          </div>
                          <div className="text-right text-sm text-white">
                            <div>{formatCurrency(match.revenue)}</div>
                            <div>{formatCurrency(match.assets)}</div>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-3">
                          <div className="h-3 flex-1 border border-white/10 bg-white/5">
                            <div
                              className="h-full bg-[#E50914] shadow-[0_0_18px_rgba(229,9,20,0.35)]"
                              style={{ width: `${confidence}%` }}
                            />
                          </div>
                          <div className="min-w-12 text-right text-xs uppercase tracking-[0.2em] text-[#888888]">
                            {confidence}%
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </AtmosphericCard>
            </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}

export default LookalikeMatch
