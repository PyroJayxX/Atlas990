import { NavLink } from 'react-router-dom'

type NavItem = {
  label: string
  to: string
  end?: boolean
}

type LeadScoringTopNavProps = {
  className?: string
}

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/', end: true },
  { label: 'Formula Score', to: '/lead-scoring/formula' },
  { label: 'ML Score', to: '/lead-scoring/model' },
  { label: 'Lookalike', to: '/lookalike-match' },
]

function LeadScoringTopNav({ className }: LeadScoringTopNavProps) {
  return (
    <nav className={`flex items-center gap-8 text-[0.72rem] uppercase tracking-[0.3em] text-[#888888] ${className ?? ''}`}>
      {navItems.map((item) => (
        <NavLink
          key={item.label}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `transition-colors hover:text-white ${isActive ? 'text-white' : ''}`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export default LeadScoringTopNav
