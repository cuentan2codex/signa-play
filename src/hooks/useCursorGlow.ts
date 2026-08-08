'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook that creates a smooth cursor-following glow effect for the Liquid Glass theme.
 * Uses requestAnimationFrame for 60fps tracking with lerped movement.
 */
export function useCursorGlow() {
  const glowRef = useRef<HTMLDivElement | null>(null);
  const targetPos = useRef({ x: -500, y: -500 });
  const currentPos = useRef({ x: -500, y: -500 });
  const rafId = useRef<number>(0);

  const animate = useCallback(() => {
    const lerp = 0.08;
    currentPos.current.x += (targetPos.current.x - currentPos.current.x) * lerp;
    currentPos.current.y += (targetPos.current.y - currentPos.current.y) * lerp;

    if (glowRef.current) {
      glowRef.current.style.left = `${currentPos.current.x}px`;
      glowRef.current.style.top = `${currentPos.current.y}px`;
    }

    rafId.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    // Create glow element
    const glow = document.createElement('div');
    glow.className = 'lg-cursor-glow';
    glow.style.opacity = '0';
    document.body.appendChild(glow);
    glowRef.current = glow;

    // Handle mouse movement
    const handleMouseMove = (e: MouseEvent) => {
      targetPos.current.x = e.clientX;
      targetPos.current.y = e.clientY;
      if (glow.style.opacity === '0') {
        glow.style.opacity = '1';
      }
    };

    // Hide glow when mouse leaves window
    const handleMouseLeave = () => {
      if (glowRef.current) {
        glowRef.current.style.opacity = '0';
      }
    };

    // Show glow when mouse enters
    const handleMouseEnter = () => {
      if (glowRef.current) {
        glowRef.current.style.opacity = '1';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    // Start animation loop
    rafId.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      cancelAnimationFrame(rafId.current);
      glow.remove();
    };
  }, [animate]);

  return glowRef;
}
