import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import BrutalButton from './ui/BrutalButton';

gsap.registerPlugin(ScrollTrigger);

export default function Navbar() {
  const navRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeHash, setActiveHash] = useState('');
  const mobileMenuRef = useRef(null);
  const mobileLinksRef = useRef([]);

  const links = [
    { name: 'HOME', href: '#home' },
    { name: 'PROBLEM', href: '#problem' },
    { name: 'HOW IT WORKS', href: '#how-it-works' },
    { name: 'FEATURES', href: '#features' },
    { name: 'IMPACT', href: '#impact' },
  ];

  useEffect(() => {
    // Scroll behavior - compress height & add background
    const nav = navRef.current;
    
    gsap.to(nav, {
      scrollTrigger: {
        trigger: document.body,
        start: 'top top',
        end: '80px top',
        scrub: true,
      },
      backgroundColor: 'rgba(10,10,10,0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '2px solid rgba(255,225,53,0.4)',
      height: '64px',
    });

    // Mobile menu animations
    if (mobileMenuOpen) {
      gsap.fromTo(mobileMenuRef.current, 
        { x: '100vw' },
        { x: 0, duration: 0.5, ease: 'power3.out' }
      );
      
      gsap.fromTo(mobileLinksRef.current,
        { x: 40, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.4, stagger: 0.07, delay: 0.2, ease: 'power2.out' }
      );
    }
  }, [mobileMenuOpen]);

  useEffect(() => {
    // Active section tracking
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setActiveHash('#' + entry.target.id);
        }
      });
    }, { threshold: 0.5 });

    const sections = document.querySelectorAll('section[id]');
    sections.forEach(s => observer.observe(s));
    
    return () => observer.disconnect();
  }, []);

  const toggleMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  return (
    <>
      <nav 
        ref={navRef}
        className="fixed top-0 left-0 w-full h-[80px] z-[9000] flex justify-between items-center px-6 md:px-12 border-b border-[rgba(250,249,246,0.08)] bg-transparent"
      >
        {/* Left: Logo */}
        <div className="flex items-center group cursor-pointer">
          <span className="font-sans text-[2rem] font-black text-paper relative tracking-[-0.02em]">
            <span className="highlight-word group-hover:after:w-full tracking-tighter flex items-center">
              TS<span className="inline-block w-[1.2rem] border-b-[3px] border-yellow mb-[0.2rem] ml-[0.1rem]"></span>
            </span>
          </span>
        </div>

        {/* Center: Nav Links (Desktop) */}
        <div className="hidden md:flex items-center gap-[40px]">
          {links.map((link, i) => {
            const isActive = activeHash === link.href;
            return (
              <a 
                key={i} 
                href={link.href}
                className={`relative font-mono text-[0.72rem] uppercase tracking-[0.18em] transition-colors duration-200 group ${isActive ? 'text-paper opacity-100' : 'text-paper/60 hover:text-paper hover:opacity-100'}`}
              >
                {link.name}
                <span className={`absolute -bottom-1 left-0 h-[3px] bg-yellow transition-all duration-300 ${isActive ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
              </a>
            );
          })}
        </div>

        {/* Right: Button & Hamburger */}
        <div className="flex items-center gap-6">
          <BrutalButton variant="primary" className="hidden md:inline-flex shrink-0 border-ink px-6 py-3 text-[0.72rem]">
            GET MATCHED &rarr;
          </BrutalButton>
          
          {/* Hamburger (Mobile) */}
          <button 
            className="md:hidden flex flex-col justify-center items-center w-7 h-7 gap-[8px] z-[99999] relative"
            onClick={toggleMenu}
          >
            <span 
              className={`w-[28px] h-[2px] bg-paper block transition-transform duration-300 transform-origin-center ${mobileMenuOpen ? 'rotate-45 translate-y-[5px]' : ''}`}
            ></span>
            <span 
              className={`w-[28px] h-[2px] bg-paper block transition-transform duration-300 transform-origin-center ${mobileMenuOpen ? '-rotate-45 -translate-y-[5px]' : ''}`}
            ></span>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          ref={mobileMenuRef}
          className="fixed inset-0 w-full h-full bg-ink z-[9999] border-l-4 border-yellow flex flex-col justify-center px-8"
          style={{ transform: 'translateX(100vw)' }}
        >
          <div className="flex flex-col gap-6">
            {links.map((link, i) => (
              <a 
                key={i} 
                href={link.href}
                className="font-sans text-5xl font-bold text-paper tracking-tighter"
                ref={el => mobileLinksRef.current[i] = el}
                onClick={toggleMenu}
              >
                {link.name}
              </a>
            ))}
          </div>
          
          <div className="mt-16" ref={el => mobileLinksRef.current[links.length] = el}>
            <BrutalButton variant="primary" className="w-full py-4 text-lg">
              GET MATCHED &rarr;
            </BrutalButton>
          </div>

          <div 
            className="absolute bottom-4 left-8 font-mono text-xs uppercase text-yellow opacity-60 tracking-widest"
          >
            v1.0.0
          </div>
        </div>
      )}
    </>
  );
}
