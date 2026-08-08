'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-14 h-7" />;

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="relative w-14 h-7 rounded-full transition-colors duration-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      style={{ backgroundColor: isDark ? '#1e293b' : '#7dd3fc' }}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {/* Stars (visible in dark mode) */}
      <svg
        className="absolute top-1 left-1 w-2.5 h-2.5 text-yellow-300 transition-opacity duration-500"
        style={{ opacity: isDark ? 1 : 0 }}
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <circle cx="12" cy="12" r="3" />
      </svg>
      <svg
        className="absolute top-2 left-3.5 w-1.5 h-1.5 text-yellow-200 transition-opacity duration-500"
        style={{ opacity: isDark ? 0.8 : 0 }}
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <circle cx="12" cy="12" r="3" />
      </svg>
      <svg
        className="absolute bottom-1.5 left-2 w-2 h-2 text-yellow-300 transition-opacity duration-500"
        style={{ opacity: isDark ? 0.6 : 0 }}
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <circle cx="12" cy="12" r="3" />
      </svg>

      {/* Sun / Moon circle */}
      <div
        className="absolute top-0.5 w-6 h-6 rounded-full transition-all duration-500 flex items-center justify-center"
        style={{
          left: isDark ? '1.75rem' : '0.125rem',
          backgroundColor: isDark ? '#cbd5e1' : '#fff',
          boxShadow: isDark
            ? '0 0 8px 2px rgba(203, 213, 225, 0.4)'
            : '0 0 6px 2px rgba(56, 189, 248, 0.5)',
        }}
      >
        {/* Sun icon (visible in light mode) */}
        <svg
          className="w-4 h-4 transition-all duration-500"
          style={{
            opacity: isDark ? 0 : 1,
            transform: isDark ? 'rotate(90deg) scale(0.5)' : 'rotate(0deg) scale(1)',
            color: '#0284c7',
          }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>

        {/* Moon icon (visible in dark mode) */}
        <svg
          className="w-4 h-4 absolute transition-all duration-500"
          style={{
            opacity: isDark ? 1 : 0,
            transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0.5)',
            color: '#334155',
          }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </div>
    </button>
  );
}
