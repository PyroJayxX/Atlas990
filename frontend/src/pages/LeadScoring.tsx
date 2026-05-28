import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AtmosphericCard from '../components/AtmosphericCard'
import SidebarShell from '../components/SidebarShell'

type FinancialFeature = {
  name: string
  value: string
  detail: string
  unusual?: boolean
}

type LeadScoringRecord = {
  ein: string
  organizationName: string
  state: string
  score: number
  summary: string
  features: FinancialFeature[]
}

const mockLead: LeadScoringRecord = {
  ein: '23-1109223',
  organizationName: 'Advanced Medical Research Inst.',
  state: 'MA',
  score: 87,
  summary: 'Internal Lead Intelligence Assessment & Forecast',
  features: [
    {
      name: 'Revenue Growth',
      value: '+14.2%',
      detail: 'Exceptionally strong growth against peer cohort.',
    },
    {
      name: 'Administrative Expenses',
      value: '6.0%',
      detail: 'Lean overhead profile with efficient operating spend.',
    },
    {
      name: 'Asset Size',
      value: '$11.0M',
      detail: 'Total reported assets under management for fiscal year 2024.',
    },
    {
      name: 'Audit Status',
      value: 'CLEAN',
      detail: 'No reporting discrepancies detected in the latest review cycle.',
    },
  ],
}

function LeadScoring() {
  const { ein = mockLead.ein } = useParams<{ ein: string }>()
  const [record] = useState<LeadScoringRecord>(mockLead)

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="flex min-h-screen w-full bg-[#0a0a0a]">
        <SidebarShell activeLabel="High Priority" />

        <section className="flex min-w-0 flex-1 flex-col bg-[#0a0a0a] py-4">
          <div className="flex flex-1 flex-col w-full px-4 pr-2 lg:px-6 lg:pr-3">
            <header className="flex items-center justify-between border border-white/10 bg-[#111111] px-6 py-4 shadow-[0_0_20px_rgba(229,9,20,0.08)]">
              <nav className="flex items-center gap-8 text-[0.72rem] uppercase tracking-[0.3em] text-[#888888]">
                <Link className="transition-colors hover:text-white" to="/">
                  Dashboard
                </Link>
                <span className="text-white">Leads</span>
                <span className="transition-colors hover:text-white">Segments</span>
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
                    {record.organizationName}
                  </h1>
                  <p className="mt-2 text-sm text-[#888888]">{record.summary}</p>
                </div>
                <div className="text-right text-[0.68rem] uppercase tracking-[0.22em] text-[#888888]">
                  <p>Last crawled</p>
                  <p className="mt-1 text-white">2023.10.27 / 14:42 GMT</p>
                </div>
              </div>

              <div className="grid gap-4 px-5 py-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <AtmosphericCard className="p-6">
                <p className="text-[0.7rem] uppercase tracking-[0.28em] text-[#888888]">
                  Calculated lead score
                </p>
                <div className="mt-8 flex items-end gap-3">
                  <span className="text-[7rem] font-black leading-none text-[#E50914] drop-shadow-[0_0_20px_rgba(229,9,20,0.6)] sm:text-[8.5rem]">
                    {record.score}
                  </span>
                  <span className="pb-4 text-sm uppercase tracking-[0.22em] text-[#888888]">
                    / 100
                  </span>
                </div>
                <div className="mt-6 h-1.5 w-full bg-white/10">
                  <div
                    className="h-full bg-[#E50914] shadow-[0_0_18px_rgba(229,9,20,0.45)]"
                    style={{ width: `${record.score}%` }}
                  />
                </div>
                <p className="mt-4 text-[0.72rem] uppercase tracking-[0.22em] text-[#888888]">
                  Scoring confidence
                </p>
              </AtmosphericCard>

              <article className="grid gap-4">
                {record.features.map((feature) => (
                  <AtmosphericCard key={feature.name} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[0.68rem] uppercase tracking-[0.28em] text-[#888888]">
                          {feature.name}
                        </p>
                        <p className="mt-2 text-sm text-[#888888]">{feature.detail}</p>
                      </div>
                      <div className="text-right text-3xl font-semibold tracking-[-0.05em] text-white">
                        {feature.value}
                      </div>
                    </div>
                  </AtmosphericCard>
                ))}
              </article>
            </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}

export default LeadScoring
