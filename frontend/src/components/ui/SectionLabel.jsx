import React from 'react';

export default function SectionLabel({ label, dark = false, className = 'left-4 top-32' }) {
  return (
    <div className={`absolute origin-top-left -rotate-90 font-mono text-xs uppercase tracking-[0.2em] opacity-40 ${dark ? 'text-paper' : 'text-ink'} ${className}`}>
      {label}
    </div>
  );
}
