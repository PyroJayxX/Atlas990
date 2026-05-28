import type { ReactNode } from 'react'

type AtmosphericCardProps = {
  children: ReactNode
  className?: string
}

function AtmosphericCard({ children, className = '' }: AtmosphericCardProps) {
  return (
    <article
      className={`relative overflow-hidden border border-white/10 bg-[#141414] shadow-[0_4px_20px_rgba(229,9,20,0.1)] ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_280px_at_10%_16%,rgba(229,9,20,0.18),transparent_58%),linear-gradient(180deg,rgba(229,9,20,0.05)_0%,rgba(20,20,20,0)_54%)]" />
      <div className="relative">{children}</div>
    </article>
  )
}

export default AtmosphericCard