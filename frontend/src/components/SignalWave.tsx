/**
 * Decorative RF backdrop for the hero: three looping sine traces plus
 * expanding pulse rings from a centre "emitter". Pure CSS animation; each
 * path is twice the view box wide and slides by a whole number of wavelengths, so the loop is seamless.
 */

const WIDTH = 1200
const HEIGHT = 240

/** A sine path spanning 2×WIDTH so translating by -50% loops seamlessly. */
function sinePath(amplitude: number, wavelength: number, phase = 0): string {
  const mid = HEIGHT / 2
  const pts: string[] = []
  for (let x = 0; x <= WIDTH * 2; x += 8) {
    const y = mid + amplitude * Math.sin(((x + phase) / wavelength) * Math.PI * 2)
    pts.push(`${x === 0 ? 'M' : 'L'}${x},${y.toFixed(1)}`)
  }
  return pts.join(' ')
}

// Each group slides by -50% of the view box (600 units). Every wavelength divides 600, so the loop has no seam.
const TRACES = [
  { d: sinePath(38, 300), stroke: '#22d3ee', width: 2, opacity: 0.55, anim: 'animate-wave' },
  { d: sinePath(22, 200, 60), stroke: '#3b82f6', width: 1.5, opacity: 0.4, anim: 'animate-wave-slow' },
  { d: sinePath(12, 120, 30), stroke: '#67e8f9', width: 1, opacity: 0.3, anim: 'animate-wave' },
]

export default function SignalWave({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none select-none ${className}`}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="w-full h-full overflow-hidden"
        style={{ maskImage: 'linear-gradient(90deg, transparent, #000 15%, #000 85%, transparent)' }}
      >
        {TRACES.map((t, i) => (
          <g key={i} className={t.anim} style={{ transformBox: 'view-box' }}>
            <path
              d={t.d}
              fill="none"
              stroke={t.stroke}
              strokeWidth={t.width}
              strokeOpacity={t.opacity}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
      </svg>

      {/* Emitter pulse rings */}
      <div className="absolute inset-0 flex items-center justify-center">
        {[0, 0.6, 1.2].map((delay) => (
          <span
            key={delay}
            className="absolute w-24 h-24 rounded-full border border-cyan-400/30 animate-pulse-ring"
            style={{ animationDelay: `${delay}s`, animationDuration: '3.6s' }}
          />
        ))}
      </div>
    </div>
  )
}
