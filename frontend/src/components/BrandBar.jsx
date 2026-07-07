export default function BrandBar({ title = "BibitLive", subtitle = "Pantau bibit langsung" }) {
  return (
    <div className="lg:hidden bg-bl-forest px-5 py-4 text-white shrink-0">
      <div className="flex items-center gap-3">
        <img
          src="/logo-bibitlive.png"
          alt=""
          className="w-10 h-10 rounded-xl object-cover ring-1 ring-white/15 shrink-0"
        />
        <div className="min-w-0">
          <div className="text-base font-bold truncate">{title}</div>
          <div className="text-xs text-bl-mint truncate">{subtitle}</div>
        </div>
      </div>
    </div>
  );
}
