import { useEffect, useRef, useState, type CSSProperties } from 'react'
const IMAGE = '/florian-schindler-dNPkHjd3pZk-unsplash.jpg'

const IMAGE_HEIGHT = 420 // keep in sync with .card.is-open .card-image in App.css
const DURATION = 700 // keep in sync with --card-duration in App.css

// Boxes are described by their centre so the card grows out from its middle.
type Box = { top: number; left: number; width: number; height: number }

export function ExpandingCard() {
  const slot = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const [from, setFrom] = useState<Box | null>(null)
  const [to, setTo] = useState<Box | null>(null)
  const [open, setOpen] = useState(false)
  // Transitions are only switched on once the card is fixed at its px start
  // box; otherwise width/height interpolate from 100% of the *viewport*.
  const [animating, setAnimating] = useState(false)
  const timer = useRef<number>(0)

  function expand() {
    if (from) return
    const r = slot.current!.getBoundingClientRect()
    const width = Math.min(700, window.innerWidth - 32)
    // Size the panel to its copy: measure the text at the expanded width.
    const c = content.current!
    c.style.width = `${width}px`
    c.style.height = 'auto'
    c.style.bottom = 'auto'
    const textHeight = c.offsetHeight
    c.style.width = c.style.height = c.style.bottom = ''
    const height = Math.min(IMAGE_HEIGHT + textHeight, window.innerHeight - 32)
    setFrom({
      top: r.top + r.height / 2,
      left: r.left + r.width / 2,
      width: r.width,
      height: r.height,
    })
    setTo({
      top: window.innerHeight / 2,
      left: window.innerWidth / 2,
      width,
      height,
    })
    // two frames so the browser paints the start box before we move it
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnimating(true)
        setOpen(true)
      }),
    )
  }

  function collapse() {
    if (!open) return
    setOpen(false)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setFrom(null)
      setAnimating(false)
    }, DURATION)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && collapse()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const box = open ? to : from

  return (
    <>
      <div ref={slot} className="card-slot">
        <div
          className={`card ${from ? 'is-floating' : ''} ${animating ? 'is-animating' : ''} ${open ? 'is-open' : ''}`}
          style={
            box
              ? ({ ...box, '--content-w': `${to?.width}px` } as CSSProperties)
              : undefined
          }
          onClick={expand}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && expand()}
        >
          <img className="card-image" src={IMAGE} alt="" />
          <header className="card-header">
            <span className="card-eyebrow">Travel</span>
            <h2 className="card-title">
              Chase the Light Above the Clouds
            </h2>
          </header>
          <div className="card-content" ref={content}>
            <p>
              The best view is rarely the one you planned for. It's usually
              the one you reach ten minutes before everyone else wakes up,
              with cold hands and a thermos that's already half empty.
            </p>
            <p>
              Pack light, leave early, and give the mountains your full
              attention. The first light only lasts a few minutes, and it
              never looks the same twice.
            </p>
            <p>Somewhere out there, the sun is about to rise. Go and meet it.</p>
          </div>
        </div>
      </div>
      {from && (
        <div
          className={`backdrop ${open ? 'is-open' : ''}`}
          onClick={collapse}
        />
      )}
    </>
  )
}
