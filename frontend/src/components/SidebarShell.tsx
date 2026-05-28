import { Link } from 'react-router-dom'
import SidebarBrand from './SidebarBrand'

type SidebarItem = {
  label: string
  path: string
}

type SidebarShellProps = {
  activeLabel: string
}

const sidebarItems: SidebarItem[] = [
  { label: 'Overview', path: '/' },
  { label: 'High Priority', path: '/lead-scoring/13-2874925' },
  { label: 'Bulk Export', path: '/lookalike-match/13-2874925' },
]

function SidebarShell({ activeLabel }: SidebarShellProps) {
  return (
    <aside className="flex w-[350px] flex-col border-r border-white/10 bg-black px-4 py-4">
      <SidebarBrand />

      <nav className="mt-5 space-y-1">
        {sidebarItems.map((item) => {
          const active = item.label === activeLabel

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
    </aside>
  )
}

export default SidebarShell
