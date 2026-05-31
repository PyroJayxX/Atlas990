import { useEffect } from 'react'
import type { ReactNode } from 'react'
import AtmosphericCard from './AtmosphericCard'

type ExportModalProps = {
  open: boolean
  title: string
  eyebrow: string
  description: string
  onClose: () => void
  onPrimary: () => void
  primaryLabel: string
  primaryDisabled?: boolean
  children: ReactNode
}

function ExportModal({
  open,
  title,
  eyebrow,
  description,
  onClose,
  onPrimary,
  primaryLabel,
  primaryDisabled = false,
  children,
}: ExportModalProps) {
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label="Close export modal"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm"
      />

      <div className="relative z-10 w-full max-w-2xl">
        <AtmosphericCard className="relative overflow-hidden border border-white/10 bg-[#111111] p-0 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E50914] to-transparent opacity-80" />

          <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#888888]">{eyebrow}</p>
              <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-white">{title}</h2>
              <p className="mt-2 text-sm text-[#888888]">{description}</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="border border-white/10 bg-white/5 px-3 py-2 text-[0.65rem] uppercase tracking-[0.2em] text-[#bbbbbb] transition-colors hover:bg-white/10 hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="px-6 py-5">{children}</div>

          <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
            <p className="text-xs text-[#666666]">CSV export downloads immediately to your device.</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="border border-white/10 bg-transparent px-4 py-2.5 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#bbbbbb] transition-colors hover:border-white/20 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onPrimary}
                disabled={primaryDisabled}
                className="border border-[#E50914] bg-[#E50914] px-4 py-2.5 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-white transition-colors hover:bg-[#ff1e2d] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-[#666666]"
              >
                {primaryLabel}
              </button>
            </div>
          </div>
        </AtmosphericCard>
      </div>
    </div>
  )
}

export default ExportModal