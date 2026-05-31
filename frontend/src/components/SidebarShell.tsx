import { Link, useLocation } from 'react-router-dom'
import SidebarBrand from './SidebarBrand'

type SidebarItem = {
  label: string
  path: string
}

type SidebarShellProps = {
  activeLabel?: string
}

const sidebarItems: SidebarItem[] = [
  { label: 'Overview',      path: '/' },
  { label: 'Formula Scoring', path: '/lead-scoring/formula' },
  { label: 'XGBoost Scoring',      path: '/lead-scoring/model' },
  { label: 'Vector Similarity Search',     path: '/lookalike-match' },
]

function SidebarShell({ activeLabel }: SidebarShellProps) {
  const location = useLocation()

  return (
    <aside className="flex w-[350px] flex-col border-r border-white/10 bg-[#111111] px-4 py-4">
      <SidebarBrand />

      <nav className="mt-5 space-y-1">
        {sidebarItems.map((item) => {
          const active = location.pathname === item.path || item.label === activeLabel

          return (
            <Link
              key={item.label}
              to={item.path}
              className={`group flex items-center gap-3 border border-transparent px-4 py-3 text-sm font-medium text-[#d2d2d2] transition-colors hover:border-white/10 hover:bg-[#111111] hover:text-white ${
                active ? 'bg-[#0f0f0f] text-white' : ''
              }`}
            >
              <span
                className={`h-5 w-1.5 shrink-0 rounded-none bg-[#E50914] transition-opacity ${
                  active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="mt-auto border-t border-white/10 pt-4">
        <p className="mt-1 text-[1rem] text-[#444444]">IRS 990 Intelligence Engine</p>
        <p className="mt-3 text-[0.8rem] text-[#333333]">v0.1.0 · Development Build</p>
      </div>
    </aside>
  )
}

export default SidebarShell