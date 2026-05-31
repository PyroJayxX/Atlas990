type SidebarBrandProps = {
  subtitle?: string
}

function SidebarBrand({ subtitle = 'Lead Intelligence' }: SidebarBrandProps) {
  return (
    <div className="px-5 py-5">
      <div className="flex items-center justify-center">
        <div className="flex-shrink-0 h-10 w-10 flex items-center justify-end  drop-shadow-[0_0_8px_rgba(229,9,20,0.4)]">
          <img src="/logo.ico" alt="Atlas990 logo" className="h-10 w-10 rounded-sm" />
        </div>

        <div className="px-3 text-center">
          <p className="text-[2rem] font-black uppercase tracking-[-0.1em] text-[#E50914] drop-shadow-[0_0_30px_rgba(229,9,20,0.8)]">
            ATLAS990
          </p>
        </div>

        {/* Right placeholder: same width as left to balance centering */}
        <div className="w-10 flex-shrink-0" />
      </div>

      <p className="mt-1 text-[0.66rem] uppercase tracking-[0.38em] text-[#888888] text-center">{subtitle}</p>

      <div className="mt-4 border-t border-white/10" />
    </div>
  )
}

export default SidebarBrand
