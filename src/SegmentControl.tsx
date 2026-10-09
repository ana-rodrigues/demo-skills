type Option<T extends string> = { value: T; label: string }

export function SegmentControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
}) {
  const index = options.findIndex((o) => o.value === value)

  return (
    <div className="segment">
      <div className="segment-track" role="radiogroup">
        <span
          className="segment-thumb"
          style={{
            width: `calc(100% / ${options.length})`,
            transform: `translateX(${index * 100}%)`,
          }}
        />
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className="segment-option"
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
