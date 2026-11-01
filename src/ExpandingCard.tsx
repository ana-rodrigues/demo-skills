import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react'
const IMAGE = '/florian-schindler-dNPkHjd3pZk-unsplash.jpg'

const IMAGE_HEIGHT = 420 // keep in sync with .card.is-open .card-image in App.css
const DURATION = 700 // fallback if --card-duration can't be read

// Spring variant: one progress value p (0 = docked, 1 = expanded) drives every
// property, so a drag, a tap and an interruption all act on the same number.
const DRAG_DISTANCE = 300 // px of vertical drag that equals the full 0 -> 1 travel
const DRAG_THRESHOLD = 10 // hysteresis before a press becomes a drag
const DECELERATION = 0.99 // snappier than scroll (0.998) so a flick throws the card
const RADIUS_CLOSED = 28
const RADIUS_OPEN = 24

// Boxes are described by their centre so the card grows out from its middle.
type Box = { top: number; left: number; width: number; height: number }

type Spring = { p: number; v: number; target: number; raf: number; last: number }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

// Progressive resistance past the edge instead of a hard stop.
function rubberband(overshoot: number, constant = 0.55) {
  return (overshoot * constant) / (1 + constant * Math.abs(overshoot))
}

// Where a release velocity (units/s) would coast to, exponential decay.
function project(velocity: number) {
  return ((velocity / 1000) * DECELERATION) / (1 - DECELERATION)
}

export function ExpandingCard({ spring = false }: { spring?: boolean }) {
  const slot = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const image = useRef<HTMLImageElement>(null)
  const header = useRef<HTMLElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
  const [from, setFrom] = useState<Box | null>(null)
  const [to, setTo] = useState<Box | null>(null)
  const [open, setOpen] = useState(false)
  // Transitions are only switched on once the card is fixed at its px start
  // box; otherwise width/height interpolate from 100% of the *viewport*.
  const [animating, setAnimating] = useState(false)
  const timer = useRef<number>(0)

  const boxes = useRef<{ from: Box; to: Box } | null>(null)
  const s = useRef<Spring>({ p: 0, v: 0, target: 0, raf: 0, last: 0 })
  const drag = useRef<{
    startX: number
    startY: number
    startP: number
    active: boolean
    history: { y: number; t: number }[]
  } | null>(null)
  const justDragged = useRef(false)

  // Read the active variant's duration so the unmount timer never cuts a
  // transition short (before = 900ms).
  function duration() {
    const v = getComputedStyle(slot.current!).getPropertyValue('--card-duration')
    return parseFloat(v) || DURATION
  }

  // ---------- Spring variant ----------

  function render(p: number) {
    const b = boxes.current
    if (!b) return
    const c = card.current!.style
    c.top = `${lerp(b.from.top, b.to.top, p)}px`
    c.left = `${lerp(b.from.left, b.to.left, p)}px`
    c.width = `${lerp(b.from.width, b.to.width, p)}px`
    c.height = `${lerp(b.from.height, b.to.height, p)}px`
    c.borderRadius = `${lerp(RADIUS_CLOSED, RADIUS_OPEN, clamp01(p))}px`
    c.setProperty('--content-w', `${b.to.width}px`)
    image.current!.style.height = `${lerp(b.from.height, IMAGE_HEIGHT, p)}px`
    header.current!.style.transform = `translate(${6 * p}px, ${6 * p}px)`
    // Text arrives after the card has started growing, and leaves first
    const text = clamp01((p - 0.35) / 0.45)
    const t = content.current!.style
    t.opacity = `${text}`
    t.visibility = text > 0 ? 'visible' : 'hidden'
    if (backdrop.current) {
      const d = backdrop.current.style
      const dim = clamp01(p)
      d.opacity = `${dim}`
      const blur = matchMedia('(prefers-reduced-transparency: reduce)').matches
        ? 'none'
        : `blur(${14 * dim}px) saturate(${1 + 0.4 * dim})`
      d.backdropFilter = blur
      d.setProperty('-webkit-backdrop-filter', blur)
    }
  }

  function reset() {
    const c = card.current!.style
    for (const prop of ['top', 'left', 'width', 'height', 'border-radius', '--content-w'])
      c.removeProperty(prop)
    image.current!.style.removeProperty('height')
    header.current!.style.removeProperty('transform')
    content.current!.style.removeProperty('opacity')
    content.current!.style.removeProperty('visibility')
  }

  // Critically damped by default; bounce only when a flick carried momentum.
  function animateTo(target: number, bounce = false) {
    const st = s.current
    st.target = target
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const response = reduced ? 0.12 : 0.4
    const damping = bounce ? 0.8 : 1
    const k = (2 * Math.PI / response) ** 2
    const c = 2 * damping * Math.sqrt(k)
    cancelAnimationFrame(st.raf)
    st.last = 0

    const tick = (now: number) => {
      const dt = Math.min((now - (st.last || now)) / 1000, 1 / 30)
      st.last = now
      // fixed substeps keep the integration stable at any frame rate
      for (let i = 0, n = Math.ceil(dt * 240); i < n; i++) {
        const h = dt / n
        st.v += (-k * (st.p - st.target) - c * st.v) * h
        st.p += st.v * h
      }
      if (Math.abs(st.v) < 0.001 && Math.abs(st.p - st.target) < 0.0005) {
        st.p = st.target
        st.v = 0
        render(st.p)
        if (st.target === 0) setFrom(null)
        return
      }
      render(st.p)
      st.raf = requestAnimationFrame(tick)
    }
    st.raf = requestAnimationFrame(tick)
  }

  function onPointerDown(e: PointerEvent) {
    if (!spring || !from) return
    // let the text scroll if it needs to
    const text = content.current!
    if (text.contains(e.target as Node) && text.scrollHeight > text.clientHeight) return
    justDragged.current = false
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      startP: s.current.p,
      active: false,
      history: [],
    }
  }

  function onPointerMove(e: PointerEvent) {
    const d = drag.current
    if (!d) return
    const st = s.current
    if (!d.active) {
      const dy = e.clientY - d.startY
      if (Math.abs(dy) < DRAG_THRESHOLD || Math.abs(dy) < Math.abs(e.clientX - d.startX)) return
      // Grab: stop the spring wherever it is, and track from that live value
      d.active = true
      justDragged.current = true
      cancelAnimationFrame(st.raf)
      d.startP = st.p
      d.startY = e.clientY
      card.current!.setPointerCapture(e.pointerId)
    }
    const raw = d.startP - (e.clientY - d.startY) / DRAG_DISTANCE
    st.p = raw > 1 ? 1 + rubberband(raw - 1) : Math.max(0, raw)
    st.v = 0
    d.history.push({ y: e.clientY, t: e.timeStamp })
    while (d.history.length > 2 && e.timeStamp - d.history[0].t > 100) d.history.shift()
    render(st.p)
  }

  function onPointerUp() {
    const d = drag.current
    drag.current = null
    if (!d?.active) return
    const st = s.current
    const first = d.history[0]
    const last = d.history[d.history.length - 1]
    const dt = last && first ? (last.t - first.t) / 1000 : 0
    // px/s of the finger -> progress/s; moving up means opening
    st.v = dt > 0 ? -(last.y - first.y) / dt / DRAG_DISTANCE : 0
    // Decide from where the flick is heading, not where it let go
    const target = st.p + project(st.v) < 0.5 ? 0 : 1
    animateTo(target, target === 1 && Math.abs(st.v) > 0.5)
  }

  // ---------- Shared ----------

  function expand() {
    if (spring) {
      if (justDragged.current) return
      // Mid-close: reverse from the live value and keep the velocity
      if (from) {
        if (s.current.target === 0) animateTo(1)
        return
      }
      setupBoxes()
      s.current.p = 0
      s.current.v = 0
      animateTo(1)
      return
    }
    if (from) {
      // Mid-close: reverse. Cancel the pending unmount and retarget; CSS
      // transitions restart from the live on-screen values, so no jump.
      if (!open) {
        window.clearTimeout(timer.current)
        setOpen(true)
      }
      return
    }
    setupBoxes()
    // two frames so the browser paints the start box before we move it
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnimating(true)
        setOpen(true)
      }),
    )
  }

  function setupBoxes() {
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
    const start = {
      top: r.top + r.height / 2,
      left: r.left + r.width / 2,
      width: r.width,
      height: r.height,
    }
    const end = {
      top: window.innerHeight / 2,
      left: window.innerWidth / 2,
      width,
      height,
    }
    boxes.current = { from: start, to: end }
    setFrom(start)
    setTo(end)
    return boxes.current
  }

  function collapse() {
    if (spring) {
      if (from && s.current.target !== 0) animateTo(0)
      return
    }
    if (!open) return
    setOpen(false)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setFrom(null)
      setAnimating(false)
    }, duration() + 50)
  }

  // Paint the card at its current progress before the browser does, so the
  // floating card never shows a frame without a position.
  useLayoutEffect(() => {
    if (!spring) return
    if (from) render(s.current.p)
    else reset()
  }, [from, spring])

  useEffect(() => {
    const raf = s.current
    return () => cancelAnimationFrame(raf.raf)
  }, [])

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
          ref={card}
          className={`card ${from ? 'is-floating' : ''} ${animating ? 'is-animating' : ''} ${open ? 'is-open' : ''} ${spring ? 'is-spring' : ''}`}
          style={
            box && !spring
              ? ({ ...box, '--content-w': `${to?.width}px` } as CSSProperties)
              : undefined
          }
          onClick={expand}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && expand()}
        >
          <img ref={image} className="card-image" src={IMAGE} alt="" />
          <header ref={header} className="card-header">
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
          ref={backdrop}
          className={`backdrop ${open ? 'is-open' : ''} ${spring ? 'is-spring' : ''}`}
          onClick={collapse}
        />
      )}
    </>
  )
}
