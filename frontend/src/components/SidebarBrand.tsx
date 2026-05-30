type SidebarBrandProps = {
  subtitle?: string
}

function SidebarBrand({ subtitle = 'Lead Intelligence' }: SidebarBrandProps) {
  return (
    <div className="border border-white/10 bg-[#111111] px-5 py-5 text-center shadow-[0_0_30px_rgba(229,9,20,0.18)]">
      <p className="text-[2rem] font-black uppercase tracking-[-0.1em] text-[#E50914] drop-shadow-[0_0_28px_rgba(229,9,20,0.8)]">
        ATLAS990
      </p>
      <p className="mt-1 text-[0.66rem] uppercase tracking-[0.38em] text-[#888888]">{subtitle}</p>
    </div>
  )
}

export default SidebarBrand