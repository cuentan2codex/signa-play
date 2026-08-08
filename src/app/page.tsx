'use client';

import React, { useState, useEffect, startTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import GameMode from '@/components/GameMode';
import TrainingMode from '@/components/TrainingMode';
import { AppView } from '@/lib/types';
import { LEVELS } from '@/lib/gameData';
import { loadScore, loadProgress, loadPosesFromStorage, LevelProgress } from '@/lib/gestureEngine';
import { useTheme } from 'next-themes';
import ThemeToggle from '@/components/ThemeToggle';

export default function Home() {
  const [view, setView] = useState<AppView>('menu');
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [totalScore, setTotalScore] = useState(0);
  const [unlockedLevels, setUnlockedLevels] = useState<number[]>([1]);
  const [savedPosesCount, setSavedPosesCount] = useState(0);
  const [levelProgressData, setLevelProgressData] = useState<LevelProgress[]>([]);
  const [mounted, setMounted] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const { theme, setTheme } = useTheme();

  // Load data from localStorage only after mount (safe hydration pattern)
  useEffect(() => {
    const score = loadScore();
    const progress = loadProgress();
    const unlocked = [1];
    for (const p of progress) {
      if (p.completed) {
        unlocked.push(p.levelId + 1);
      }
    }
    const poses = loadPosesFromStorage();
    const posesCount = Object.keys(poses).length;
    // Batch state updates via a single callback to satisfy react-hooks lint
    startTransition(() => {
      setTotalScore(score);
      setUnlockedLevels(unlocked);
      setSavedPosesCount(posesCount);
      setLevelProgressData(progress);
      setMounted(true);
    });
  }, []);

  const handleLevelComplete = (levelId: number, score: number) => {
    setTotalScore((prev) => prev + score);
    const nextLevel = levelId + 1;
    if (nextLevel <= LEVELS.length && !unlockedLevels.includes(nextLevel)) {
      setUnlockedLevels((prev) => [...prev, nextLevel]);
    }
  };

  // Guard: don't render until client-side data is loaded
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-400 border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando SeñaPlay...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AnimatePresence mode="wait">
        {view === 'menu' && (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950"
          >
            {/* Top-right controls */}
            <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
              <ThemeToggle />
              <div className="relative">
                <button
                  onClick={() => setShowThemePicker(!showThemePicker)}
                  className="w-10 h-10 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm"
                  aria-label="Seleccionar tema"
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </button>

                <AnimatePresence>
                  {showThemePicker && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
                    >
                      <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Temas</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Elige un tema y su variante claro/oscuro</p>
                      </div>
                      <div className="p-3 space-y-2.5">
                        {/* Tema Predeterminado */}
                        <div className={[
                          'rounded-xl border-2 p-3 transition-all',
                          'border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20',
                        ].join(' ')}>
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-xs font-bold text-gray-800 dark:text-gray-200">Predeterminado</p>
                              <p className="text-[10px] text-muted-foreground">Tema original de SeñaPlay</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-muted-foreground">
                                {theme === 'dark' ? 'Oscuro' : 'Claro'}
                              </span>
                              <button
                                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                className="relative w-10 h-5 rounded-full transition-colors duration-300 focus:outline-none"
                                style={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#fbbf24' }}
                                aria-label={theme === 'dark' ? 'Cambiar a claro' : 'Cambiar a oscuro'}
                              >
                                <div
                                  className="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-300 flex items-center justify-center"
                                  style={{
                                    left: theme === 'dark' ? '1.375rem' : '0.125rem',
                                    backgroundColor: theme === 'dark' ? '#cbd5e1' : '#fff',
                                    boxShadow: theme === 'dark'
                                      ? '0 0 6px 1px rgba(203,213,225,0.4)'
                                      : '0 0 4px 1px rgba(251,191,36,0.5)',
                                  }}
                                >
                                  {theme === 'light' && (
                                    <svg className="w-2.5 h-2.5" style={{ color: '#f59e0b' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="12" cy="12" r="4" />
                                    </svg>
                                  )}
                                  {theme === 'dark' && (
                                    <svg className="w-2.5 h-2.5" style={{ color: '#334155' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                                    </svg>
                                  )}
                                </div>
                              </button>
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            <div className={[
                              'flex-1 h-10 rounded-lg overflow-hidden relative transition-all',
                              theme === 'light'
                                ? 'ring-2 ring-orange-400 ring-offset-1'
                                : 'opacity-50',
                            ].join(' ')}>
                              <div className="w-full h-full bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50" />
                            </div>
                            <div className={[
                              'flex-1 h-10 rounded-lg overflow-hidden relative transition-all',
                              theme === 'dark'
                                ? 'ring-2 ring-orange-500 ring-offset-1 ring-offset-gray-800'
                                : 'opacity-50',
                            ].join(' ')}>
                              <div className="w-full h-full bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {showThemePicker && (
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowThemePicker(false)}
                  />
                )}
              </div>
            </div>

            <main className="flex-1 flex items-center justify-center px-4 py-12">
              <div className="max-w-lg w-full text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="mx-auto mb-8"
                >
                  <div className="w-28 h-28 bg-gradient-to-br from-orange-400 to-amber-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-orange-400/30 mx-auto">
                    <svg className="w-16 h-16 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.05 4.575a1.575 1.575 0 10-3.15 0v3.15a3.15 3.15 0 106.3 0v-3.15M7.9 4.05a1.575 1.575 0 10-3.15 0 1.575 1.575 0 003.15 0M17.1 4.05a1.575 1.575 0 10-3.15 0 1.575 1.575 0 003.15 0M10.05 8.175a1.575 1.575 0 10-3.15 0 1.575 1.575 0 003.15 0M17.1 8.175a1.575 1.575 0 10-3.15 0 1.575 1.575 0 003.15 0" />
                    </svg>
                  </div>
                </motion.div>

                <motion.h1
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent mb-3"
                >
                  SeñaPlay
                </motion.h1>

                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-muted-foreground text-lg mb-10"
                >
                  Aprende lenguaje de señas jugando con tu cámara
                </motion.p>

                <div className="flex flex-col gap-4">
                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
                    <Button
                      onClick={() => setView('level-select')}
                      className="w-full h-16 text-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/25 rounded-2xl gap-3"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Jugar
                    </Button>
                  </motion.div>

                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
                    <Button
                      onClick={() => setView('training')}
                      variant="outline"
                      className="w-full h-14 text-base rounded-2xl gap-3 border-purple-200 text-purple-700 hover:bg-purple-50"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      Entrenar Señas
                    </Button>
                  </motion.div>
                </div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="mt-10"
                >
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      <span className="text-xs text-muted-foreground">Puntaje total</span>
                    </div>
                    <div className="text-2xl font-bold">{totalScore}</div>
                  </Card>
                </motion.div>
              </div>
            </main>

            <footer className="text-center py-4 text-xs text-muted-foreground">
              Usa tu cámara web para hacer señas y deletrear palabras
            </footer>
          </motion.div>
        )}

        {view === 'level-select' && (
          <motion.div
            key="level-select"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="min-h-screen flex flex-col bg-gradient-to-b from-orange-50 to-amber-50 dark:from-gray-950 dark:to-gray-900"
          >
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-orange-100 dark:border-gray-700">
              <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                <Button variant="ghost" onClick={() => setView('menu')} className="gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Menú
                </Button>
                <h2 className="text-lg font-bold">Seleccionar Nivel</h2>
                <div className="flex items-center gap-1.5">
                  <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  <span className="font-bold">{totalScore}</span>
                </div>
              </div>
            </header>

            <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
              <div className="flex flex-col gap-6">
                {LEVELS.map((level, index) => {
                  const isUnlocked = unlockedLevels.includes(level.id);
                  const levelProgress = levelProgressData.find((p) => p.levelId === level.id);
                  const completedWords = levelProgress?.completedWords.length || 0;
                  const progressPercent = (completedWords / level.words.length) * 100;

                  return (
                    <motion.div
                      key={level.id}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card
                        className={`p-6 transition-all hover:shadow-lg ${
                          isUnlocked
                            ? 'cursor-pointer hover:border-orange-300 bg-white'
                            : 'opacity-60 cursor-not-allowed bg-muted/50'
                        }`}
                        onClick={() => {
                          if (isUnlocked) {
                            setSelectedLevel(level.id);
                            setView('game');
                          }
                        }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${
                                isUnlocked
                                  ? 'bg-gradient-to-br from-orange-400 to-amber-500 text-white'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {isUnlocked ? level.id : (
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <h3 className="font-bold text-lg">{level.name}</h3>
                              <p className="text-sm text-muted-foreground">{level.description}</p>
                            </div>
                          </div>
                          {isUnlocked && (
                            <Badge variant="outline" className="border-orange-200 text-orange-700">
                              {level.words.length} palabras
                            </Badge>
                          )}
                        </div>

                        {isUnlocked && (
                          <div className="mt-4">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>{completedWords} de {level.words.length} completadas</span>
                              <span>{Math.round(progressPercent)}%</span>
                            </div>
                            <Progress value={progressPercent} className="h-2" />
                          </div>
                        )}

                        {!isUnlocked && (
                          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Necesitas {level.requiredScore} puntos para desbloquear
                          </div>
                        )}
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </main>
          </motion.div>
        )}

        {view === 'game' && (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen"
          >
            <GameMode
              levelId={selectedLevel}
              onBack={() => {
                setView('level-select');
                setTotalScore(loadScore());
                setLevelProgressData(loadProgress());
              }}
              onLevelComplete={handleLevelComplete}
            />
          </motion.div>
        )}

        {view === 'training' && (
          <motion.div
            key="training"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen"
          >
            <TrainingMode
              onBack={() => {
                setView('menu');
                const poses = loadPosesFromStorage();
                setSavedPosesCount(Object.keys(poses).length);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
