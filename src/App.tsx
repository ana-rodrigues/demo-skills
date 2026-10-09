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
      {/* key remounts the card so each variant starts collapsed */}
      <ExpandingCard key={variant} />
      <SegmentControl
        options={OPTIONS}
        value={variant}
        onChange={setVariant}
      />
    </main>
  )
}
