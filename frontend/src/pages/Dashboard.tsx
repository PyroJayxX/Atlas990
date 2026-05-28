import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AtmosphericCard from '../components/AtmosphericCard'
import SidebarShell from '../components/SidebarShell'

type NonprofitRow = {
  ein: string
  organizationName: string
  state: string
  totalRevenue: number
  employees?: number
  priority?: 'High' | 'Medium' | 'Low'
}

type SummaryCard = {
  label: string
  value: string
  detail: string
}

const mockRows: NonprofitRow[] = [
  {
    ein: '13-2874925',
    organizationName: 'Global Conservation Fund',
    state: 'NY',
    totalRevenue: 1420000000,
    employees: 218,
    priority: 'High',
  },
  {
    ein: '23-1109223',
    organizationName: 'Advanced Medical Research Inst.',
    state: 'MA',
    totalRevenue: 158400000,
    employees: 84,
    priority: 'High',
  },
  {
    ein: '45-9958776',
    organizationName: 'Urban Housing Initiative',
    state: 'IL',
    totalRevenue: 68000000,
    employees: 41,
    priority: 'Medium',
  },
  {
    ein: '36-1456656',
    organizationName: 'Children First Education',
    state: 'CA',
    totalRevenue: 215000000,
    employees: 132,
    priority: 'High',
  },
  {
    ein: '12-8778635',
    organizationName: 'Oceanic Preservation Trust',
    state: 'FL',
    totalRevenue: 93000000,
    employees: 58,
    priority: 'Medium',
  },
  {
    ein: '36-1123394',
    organizationName: 'Metropolitan Arts Council',
    state: 'NY',
    totalRevenue: 12000000,
    employees: 15,
    priority: 'Low',
  },
]

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function Dashboard() {
  const [rows] = useState<NonprofitRow[]>(mockRows)
  const [summaryCards, setSummaryCards] = useState<SummaryCard[]>([])

  useEffect(() => {
    const aggregate = rows.reduce((sum, row) => sum + row.totalRevenue, 0)
    const highPriority = rows.filter((row) => row.priority === 'High').length
    const peak = rows.reduce((max, row) => Math.max(max, row.totalRevenue), 0)

    setSummaryCards([
      {
        label: 'Aggregate Market Value',
        value: formatCurrency(aggregate),
        detail: 'Across the current IRS 990 registry',
      },
      {
        label: 'Active Entities',
        value: rows.length.toLocaleString('en-US'),
        detail: `${highPriority} flagged for immediate review`,
      },
      {
        label: 'Critical Alerts',
        value: rows.filter((row) => row.totalRevenue >= 100000000).length.toString(),
        detail: `Peak revenue signal ${formatCurrency(peak)}`,
      },
    ])
  }, [rows])

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="flex min-h-screen w-full bg-[#0a0a0a]">
        <SidebarShell activeLabel="Overview" />

        <section className="flex min-w-0 flex-1 flex-col bg-[#0a0a0a] py-4">
          <div className="flex flex-1 flex-col w-full px-4 pr-5 lg:px-6 lg:pr-8">
            <header className="flex items-center justify-between border border-white/10 bg-[#111111] px-6 py-4 shadow-[0_0_20px_rgba(229,9,20,0.08)]">
              <nav className="flex items-center gap-8 text-[0.72rem] uppercase tracking-[0.3em] text-[#888888]">
                <span className="text-white">Dashboard</span>
                <Link className="transition-colors hover:text-white" to="/lead-scoring/13-2874925">
                  Leads
                </Link>
                <Link className="transition-colors hover:text-white" to="/lookalike-match/13-2874925">
                  Segments
                </Link>
                <span className="transition-colors hover:text-white">Analytics</span>
              </nav>

              <div className="flex items-center gap-4">
                <div className="flex h-9 w-[300px] items-center border border-white/10 bg-[#101010] px-3 text-xs text-[#888888]">
                  Search nonprofit matrix...
                </div>
                <div className="h-4 w-4 rounded-full border border-white/20" />
                <div className="h-4 w-4 rounded-full border border-white/20" />
                <button className="border border-white/10 bg-[#161616] px-4 py-2.5 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-white">
                  Add Lead
                </button>
              </div>
            </header>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {summaryCards.map((card) => (
                <AtmosphericCard key={card.label} className="px-5 py-4">
                  <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#888888]">{card.label}</p>
                  <div className="mt-4 text-4xl font-black tracking-[-0.06em] text-white">
                    {card.value}
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.22em] text-[#888888]">{card.detail}</p>
                </AtmosphericCard>
              ))}
            </div>

            <section className="mt-5 flex-1 border border-white/10 bg-[#111111] shadow-[0_4px_20px_rgba(229,9,20,0.1)]">
              <div className="flex items-end justify-between border-b border-white/10 px-5 py-5">
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-[-0.04em] text-white">
                    Global Registry
                  </h1>
                  <p className="mt-2 text-sm text-[#888888]">Financial intelligence from IRS 990 filings.</p>
                </div>
                <div className="flex items-center gap-3 text-[0.68rem] uppercase tracking-[0.22em] text-[#888888]">
                  <button className="border border-white/10 px-3 py-2 text-white">Filter State</button>
                  <button className="border border-white/10 px-3 py-2 text-white">Revenue Class</button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[920px] w-full border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-[0.65rem] uppercase tracking-[0.28em] text-[#888888]">
                      <th className="px-5 py-4 font-semibold">EIN</th>
                      <th className="px-5 py-4 font-semibold">Organization Name</th>
                      <th className="px-5 py-4 font-semibold">State</th>
                      <th className="px-5 py-4 font-semibold">Total Revenue</th>
                      <th className="px-5 py-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.ein} className="border-b border-white/5 bg-[#101010] text-sm hover:bg-[#151515]">
                        <td className="px-5 py-4 font-mono text-[#dcdcdc]">{row.ein}</td>
                        <td className="px-5 py-4 text-white">{row.organizationName}</td>
                        <td className="px-5 py-4 uppercase tracking-[0.16em] text-[#888888]">{row.state}</td>
                        <td className="px-5 py-4 text-white">{formatCurrency(row.totalRevenue)}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-4 text-[0.72rem] uppercase tracking-[0.22em]">
                            <Link
                              className="text-[#E50914] no-underline transition-colors hover:text-white"
                              to={`/lead-scoring/${row.ein}`}
                            >
                              View Detail
                            </Link>
                            <Link
                              className="text-[#E50914] no-underline transition-colors hover:text-white"
                              to={`/lookalike-match/${row.ein}`}
                            >
                              Export
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}

export default Dashboard
