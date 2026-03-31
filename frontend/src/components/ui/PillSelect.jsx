export default function PillSelect({
  options = [],
  value,
  onChange,
  multiple = false,
  id,
}) {
  const handleClick = (option) => {
    if (multiple) {
      const current = Array.isArray(value) ? value : []
      const next = current.includes(option)
        ? current.filter((v) => v !== option)
        : [...current, option]
      onChange(next)
    } else {
      onChange(value === option ? '' : option)
    }
  }

  const isSelected = (option) =>
    multiple
      ? Array.isArray(value) && value.includes(option)
      : value === option

  return (
    <div id={id} className="flex flex-wrap gap-2" role="group">
      {options.map((option) => {
        const selected = isSelected(option.value ?? option)
        const label = option.label ?? option
        const val = option.value ?? option

        return (
          <button
            key={val}
            type="button"
            onClick={() => handleClick(val)}
            className={`
              px-4 py-2 text-xs font-bold uppercase tracking-wider
              border-2 border-ink rounded-[3px]
              transition-all duration-120
              select-none cursor-pointer
              ${selected
                ? 'bg-yellow text-ink shadow-[3px_3px_0_var(--border)]'
                : 'bg-paper text-ink hover:bg-muted'
              }
            `}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
