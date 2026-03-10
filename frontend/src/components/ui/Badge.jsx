import React from 'react';

export default function Badge({ label, color = 'ink', dark = false, className = '' }) {
  let colorClasses = '';

  if (dark) {
    colorClasses = 'border-paper text-paper';
  } else {
    if (color === 'ink') colorClasses = 'border-ink text-ink';
    else if (color === 'yellow') colorClasses = 'border-yellow text-yellow';
    else if (color === 'cyan') colorClasses = 'border-cyan text-cyan';
    else if (color === 'pink') colorClasses = 'border-pink text-pink';
  }

  return (
    <span className={`badge ${colorClasses} ${className}`}>
      {label}
    </span>
  );
}
