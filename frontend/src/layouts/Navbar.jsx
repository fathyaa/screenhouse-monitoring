import { Bell, CloudSun, Menu } from "lucide-react";

function Navbar({ onToggleSidebar }) {
  return (
    <header
      className="
        h-20
        bg-white
        border-b
        border-slate-200
        px-4
        md:px-8
        flex
        items-center
        justify-between
        sticky
        top-0
        z-30
        shadow-sm
      "
    >
      {/* LEFT */}

      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="
            p-2
            lg:hidden
            hover:bg-slate-100
            rounded-xl
            text-slate-600
            transition
          "
        >
          <Menu className="w-6 h-6" />
        </button>

        <div>
          <h1
            className="
              text-2xl
              font-black
              text-slate-900
              tracking-tight
            "
          >
            Ringkasan Screenhouse
          </h1>

          <div
            className="
              hidden
              sm:flex
              items-center
              gap-2
              mt-1
            "
          >
            <span
              className="
                w-2
                h-2
                rounded-full
                bg-emerald-500
                animate-pulse
              "
            />

            <p
              className="
                text-[10px]
                uppercase
                tracking-[2px]
                font-black
                text-emerald-700
              "
            >
              Sistem realtime aktif
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT */}

      <div className="flex items-center gap-4">
        {/* WEATHER */}

        <div
          className="
            hidden
            md:flex
            flex-col
            items-end
            border-r
            border-slate-200
            pr-5
          "
        >
          <p
            className="
              text-[10px]
              uppercase
              tracking-[2px]
              font-black
              text-slate-600
            "
          >
            Cuaca Hari Ini
          </p>

          <div className="flex items-center gap-2">
            <CloudSun
              className="
                w-4
                h-4
                text-amber-500
              "
            />

            <p
              className="
                text-sm
                font-bold
                text-slate-700
              "
            >
              Cerah Berawan • 29°C
            </p>
          </div>
        </div>

        {/* NOTIFICATION */}

        <motion.button
          whileHover={{
            scale: 1.05,
          }}
          whileTap={{
            scale: 0.95,
          }}
          className="
            relative
            p-2.5
            bg-slate-100
            hover:bg-bl-surface-muted
            rounded-xl
            transition
            border
            border-slate-200
          "
        >
          <Bell
            className="
              w-5
              h-5
              text-slate-600
            "
          />

          <span
            className="
              absolute
              top-2
              right-2
              w-2.5
              h-2.5
              rounded-full
              bg-red-500
              border-2
              border-white
            "
          />
        </motion.button>
      </div>
    </header>
  );
}

export default Navbar;
