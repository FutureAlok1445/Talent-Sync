import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useMatrixText } from '../hooks/useMatrixText';

export default function Loader() {
  const containerRef = useRef(null);
  const counterRef = useRef(null);
  const progressTopRef = useRef(null);
  const stackLinesRef = useRef([]);
  const stackBarsRef = useRef([]);
  const bigTextTopRef = useRef(null);
  const bigTextBottomRef = useRef(null);
  const yellowBarRef = useRef(null);

  const { display, scramble } = useMatrixText("TALENTSYNC", 40);
  const [showMatrix, setShowMatrix] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('loaded')) {
      document.body.classList.add('loaded');
      window.dispatchEvent(new Event('loader:done'));
      if (containerRef.current) containerRef.current.style.display = 'none';
      return;
    }
    sessionStorage.setItem('loaded', 'true');

    // Lock scroll initially
    document.body.style.overflow = 'hidden';

    const tl = gsap.timeline({
      onComplete: () => {
        document.body.style.overflow = '';
        document.body.classList.add('loaded');
        window.dispatchEvent(new Event('loader:done'));
        gsap.to(containerRef.current, { opacity: 0, pointerEvents: 'none', duration: 0.5 });
      }
    });

    // Phase 1 (0 to 1000ms)
    const counterObj = { val: 0 };
    tl.to(counterObj, {
      val: 100,
      duration: 1,
      ease: 'none',
      onUpdate: () => {
        if (counterRef.current) {
          counterRef.current.innerText = Math.floor(counterObj.val).toString().padStart(3, '0');
        }
      }
    }, 0);

    // Top progress bar (fills 0 to 100% width)
    tl.to(progressTopRef.current, {
      scaleX: 1,
      duration: 1,
      ease: 'none'
    }, 0);

    // Stack lines progress bars behind text
    tl.to(stackBarsRef.current, {
      scaleX: 1,
      duration: 1,
      ease: 'none',
      stagger: 0.1
    }, 0);
    
    // Stack lines appearing staggered
    tl.fromTo(stackLinesRef.current, {
      opacity: 0,
      x: -10
    }, {
      opacity: 1,
      x: 0,
      duration: 0.3,
      stagger: 0.1
    }, 0);

    // Phase 2 (1000ms to 1600ms)
    tl.add(() => {
      setShowMatrix(true);
      scramble();
    }, 1);

    // Phase 3 (1600ms to 2200ms)
    tl.to(bigTextTopRef.current, {
      clipPath: 'inset(-100% 0 50% 0)',
      y: '-15vh',
      duration: 0.7,
      ease: 'power3.inOut'
    }, 1.6);

    tl.to(bigTextBottomRef.current, {
      clipPath: 'inset(50% 0 -100% 0)',
      y: '15vh',
      duration: 0.7,
      ease: 'power3.inOut'
    }, 1.6);

    tl.fromTo(yellowBarRef.current, {
      x: '-100vw'
    }, {
      x: '100vw',
      duration: 0.5,
      ease: 'power4.in'
    }, 1.6);

    return () => {
      document.body.style.overflow = '';
    };
  }, [scramble]);

  const stackData = [
    { text: "TALENTSYNC" },
    { text: "AI MATCHING ENGINE" },
    { text: "v1.0.0" }
  ];

  return (
    <div ref={containerRef} className="fixed inset-0 z-[100000] bg-ink text-paper flex justify-between items-center overflow-hidden font-mono px-8 md:px-16" style={{ height: '100dvh' }}>
      
      {/* Top thin progress bar */}
      <div 
        ref={progressTopRef} 
        className="absolute top-0 left-0 h-[2px] bg-paper w-full origin-left scale-x-0"
      />

      {/* Left side counter */}
      <div 
        ref={counterRef} 
        className="text-[12vw] font-bold leading-none tracking-tighter z-20"
      >
        000
      </div>

      {/* Right side stack */}
      <div className="flex flex-col items-end gap-2 text-xs md:text-sm z-20">
        {stackData.map((item, i) => (
          <div key={i} className="relative flex justify-end" ref={el => stackLinesRef.current[i] = el}>
            <div className="absolute bottom-0 right-0 h-full bg-paper/20 origin-left scale-x-0 w-full" ref={el => stackBarsRef.current[i] = el} />
            <span className="relative z-10 px-2 py-1 uppercase tracking-widest leading-none">{item.text}</span>
          </div>
        ))}
      </div>

      {/* Center BIG Text (Phase 2 & 3) */}
      {showMatrix && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
           {/* Top Half */}
           <div 
            ref={bigTextTopRef}
            className="absolute text-[10vw] font-sans font-bold text-paper whitespace-nowrap"
            style={{ clipPath: 'inset(0 0 50% 0)' }}
          >
            {display}
          </div>
          {/* Bottom Half */}
          <div 
            ref={bigTextBottomRef}
            className="absolute text-[10vw] font-sans font-bold text-paper whitespace-nowrap"
            style={{ clipPath: 'inset(50% 0 0 0)' }}
          >
            {display}
          </div>
        </div>
      )}

      {/* Horizontal Yellow Bar (Phase 3) */}
      <div 
        ref={yellowBarRef}
        className="absolute top-1/2 left-0 w-full h-[4px] bg-yellow -translate-y-1/2 z-30 pointer-events-none"
        style={{ transform: 'translateX(-100vw)' }}
      />
    </div>
  );
}
