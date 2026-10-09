import { useState } from 'react'
import './App.css'
import { ExpandingCard } from './ExpandingCard'
import { SegmentControl } from './SegmentControl'

type Variant = 'before' | 'after'

const OPTIONS: { value: Variant; label: string }[] = [
  { value: 'before', label: 'Before' },
  { value: 'after', label: 'After' },
]

export default function App() {
  const [variant, setVariant] = useState<Variant>('before')

  return (
    <main className="stage" data-variant={variant}>
      <header className="page-header">
        <h1 className="page-title">Today</h1>
        <img className="avatar" src="/IMG_6723.jpg" alt="Profile" />
      </header>
      {/* key remounts the card so each variant starts collapsed */}
      <ExpandingCard key={variant} />
      <SegmentControl
        options={OPTIONS}
        value={variant}
        onChange={setVariant}
      />
      <footer className="page-footer">
        AI prototyping for Designers by{' '}
        <a
          href="https://github.com/ana-rodrigues"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ana Rodrigues
        </a>
      </footer>
    </main>
  )
}
