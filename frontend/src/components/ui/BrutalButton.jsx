import React from 'react';
import { useMagnetic } from '../../hooks/useMagnetic';

export default function BrutalButton({ variant = 'primary', size = 'md', surface = 'light', onClick, children, className = '' }) {
  const ref = useMagnetic(0.2);

  let variantClasses = '';
  let shadowClasses = '';
  
  if (surface === 'dark') {
    shadowClasses = 'shadow-[4px_4px_0px_#FFE135] hover:shadow-none';
    if (variant === 'primary') {
      variantClasses = 'bg-yellow text-ink';
    } else if (variant === 'secondary') {
      variantClasses = 'bg-paper text-ink border-paper text-paper hover:bg-paper hover:text-ink';
    } else if (variant === 'ghost') {
      variantClasses = 'bg-transparent border-current shadow-none';
    }
  } else {
    shadowClasses = 'shadow-[4px_4px_0px_rgba(10,10,10,0.8)] hover:shadow-none';
    if (variant === 'primary') {
      variantClasses = 'bg-ink text-paper';
    } else if (variant === 'secondary') {
      variantClasses = 'bg-paper text-ink';
    } else if (variant === 'ghost') {
      variantClasses = 'bg-transparent border-current shadow-none';
    }
  }

  const baseClasses = 'inline-flex justify-center items-center font-mono uppercase font-bold tracking-widest transition-all duration-200 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none';
  const sizeClasses = size === 'sm' ? 'px-4 py-2 text-xs' : 'px-6 py-3 text-sm';
  const borderClasses = 'border-2 border-ink';

  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`${baseClasses} ${variantClasses} ${sizeClasses} ${borderClasses} ${shadowClasses} ${className}`}
    >
      {children}
    </button>
  );
}
