'use client';

import React, { useMemo } from 'react';

/**
 * LiquidGlassBg renders the ambient background, nebulas, caustics,
 * floating particles, and refraction layer for the Liquid Glass theme.
 * This creates the deep, dark premium background with subtle organic movement.
 */
export default function LiquidGlassBg() {
  // Generate deterministic but varied particle positions
  const particles = useMemo(() => {
    const items = [];
    for (let i = 0; i < 20; i++) {
      items.push({
        id: i,
        left: `${((i * 37 + 13) % 100)}%`,
        top: `${((i * 53 + 7) % 100)}%`,
        delay: `${(i * 0.8) % 8}s`,
        duration: `${6 + (i % 5)}s`,
        size: 1 + (i % 3),
      });
    }
    return items;
  }, []);

  return (
    <div className="lg-bg-ambient" aria-hidden="true">
      {/* Nebula blobs */}
      <div className="lg-bg-nebula lg-bg-nebula-1" />
      <div className="lg-bg-nebula lg-bg-nebula-2" />
      <div className="lg-bg-nebula lg-bg-nebula-3" />

      {/* Caustic light layer */}
      <div className="lg-caustics" />

      {/* Floating particles */}
      <div className="lg-particles">
        {particles.map((p) => (
          <div
            key={p.id}
            className="lg-particle"
            style={{
              left: p.left,
              top: p.top,
              animationDelay: p.delay,
              animationDuration: p.duration,
              width: `${p.size}px`,
              height: `${p.size}px`,
            }}
          />
        ))}
      </div>

      {/* Subtle refraction distortion layer */}
      <div className="lg-refraction-layer" />
    </div>
  );
}
