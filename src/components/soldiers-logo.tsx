import logo from "@/assets/soldiers-logo.png.asset.json";

export function SoldiersLogo({ subtitle = "Performance OS" }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <img src={logo.url} alt="Soldiers Nutrition" className="h-7 w-auto" />
      <span className="text-display text-[0.7rem] tracking-[0.28em] text-primary">{subtitle}</span>
    </div>
  );
}
