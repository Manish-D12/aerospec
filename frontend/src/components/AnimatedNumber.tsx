import { animate, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

interface AnimatedNumberProps {
  value: number
  digits?: number
  /** Tween length; kept well under the 1 s tick so values settle before the next frame. */
  duration?: number
}

/**
 * Counts from the previous value to the new one. Writes straight to the DOM
 * node on each animation frame instead of re-rendering React 60×/s.
 */
export default function AnimatedNumber({ value, digits = 1, duration = 0.5 }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const fromRef = useRef(value)
  const reduce = useReducedMotion()
  // Rendered once; afterwards only the effect writes the text, so React never snaps it to the end value mid-tween.
  const [initialText] = useState(() => value.toFixed(digits))

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const from = fromRef.current
    fromRef.current = value

    if (reduce || from === value) {
      node.textContent = value.toFixed(digits)
      return
    }
    const controls = animate(from, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        node.textContent = v.toFixed(digits)
      },
    })
    return () => controls.stop()
  }, [value, digits, duration, reduce])

  return <span ref={ref}>{initialText}</span>
}
