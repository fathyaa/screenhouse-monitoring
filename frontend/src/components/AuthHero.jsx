export default function AuthHero({
  title = (
    <>
      BibitLive
      <br />
      Pembibitan Padi
    </>
  ),
  subtitle = "Tahu kondisi bibit padi Anda kapan saja, tanpa harus ke lokasi.",
}) {
  return (
    <div className="hidden lg:flex flex-1 relative overflow-hidden">
      <img
        src="/auth-pembibitan.jpg"
        alt="Bibit padi hijau di Kon Tum, Vietnam — Photo by Thái Trường Giang / Pexels"
        className="absolute inset-0 w-full h-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-bl-forest/85 via-bl-forest/50 to-bl-dark/15" />
      <div className="absolute inset-0 bg-gradient-to-t from-bl-dark/80 via-transparent to-transparent" />

      <div className="absolute top-10 left-10 flex items-center gap-3">
        <img
          src="/logo-bibitlive.png"
          alt=""
          className="w-14 h-14 rounded-2xl object-cover ring-2 ring-white/20"
        />
        <div>
          <div className="text-xl font-bold text-white">BibitLive</div>
          <div className="text-sm text-bl-mint">Pantau bibit langsung</div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 p-10 max-w-4xl text-left">
        <div className="text-5xl font-bold text-white leading-snug mb-3">{title}</div>
        <div className="text-2xl text-white/60 leading-relaxed">{subtitle}</div>
      </div>
    </div>
  );
}
