/**
 * Dynamic smokey backdrop: a deep base, slow-drifting coloured glows, an
 * animated SVG turbulence "smoke" sheet, and a fine grain overlay.
 * All CSS/SVG — no JS loop, no canvas — so it's cheap and works in the
 * static export. Motion is disabled under prefers-reduced-motion (see globals).
 */
export default function SmokeBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#07090c]"
    >
      {/* Base depth — a soft radial lift from the bottom centre. */}
      <div className="absolute inset-0 bg-[radial-gradient(125%_95%_at_50%_115%,#14403d_0%,#0c1f30_40%,#07090c_74%)]" />

      {/* A broad bloom centred behind the panel so the glass picks up colour. */}
      <div className="smoke-blob anim-b left-1/2 top-1/2 h-[70vmax] w-[70vmax] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle,#0f766e_0%,transparent_60%)] opacity-70" />

      {/* Drifting colour clouds. */}
      <div className="smoke-blob anim-a left-[-6%] top-[-8%] h-[55vmax] w-[55vmax] bg-[radial-gradient(circle,#14b8a6_0%,transparent_60%)]" />
      <div className="smoke-blob anim-b right-[-10%] top-[2%] h-[60vmax] w-[60vmax] bg-[radial-gradient(circle,#6366f1_0%,transparent_58%)]" />
      <div className="smoke-blob anim-c bottom-[-16%] left-[6%] h-[58vmax] w-[58vmax] bg-[radial-gradient(circle,#a855f7_0%,transparent_60%)]" />
      <div className="smoke-blob anim-a bottom-[-6%] right-[2%] h-[46vmax] w-[46vmax] bg-[radial-gradient(circle,#f43f5e_0%,transparent_64%)] opacity-60" />
      <div className="smoke-blob anim-c left-[28%] top-[24%] h-[44vmax] w-[44vmax] bg-[radial-gradient(circle,#22d3ee_0%,transparent_62%)] opacity-55" />

      {/* Animated turbulence smoke sheet — gives real wispy texture. */}
      <svg
        className="smoke-sheet absolute inset-0 h-full w-full opacity-[0.3] mix-blend-soft-light"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="smoke-turb">
            {/* Static noise — the wispy motion comes from the cheap CSS
                transform on .smoke-sheet, not from recomputing turbulence. */}
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.018"
              numOctaves="3"
              seed="7"
              result="noise"
            />
            <feColorMatrix in="noise" type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#smoke-turb)" />
      </svg>

      {/* Top + edge vignette for focus and depth. */}
      <div className="absolute inset-0 bg-[radial-gradient(125%_125%_at_50%_-10%,transparent_62%,rgba(0,0,0,0.4)_100%)]" />

      {/* Fine film grain. */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </div>
  );
}
