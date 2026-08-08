'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import GameMode from '@/components/GameMode';
import TrainingMode from '@/components/TrainingMode';
import { AppView } from '@/lib/types';
import { LEVELS } from '@/lib/gameData';
import { loadScore, loadProgress, loadPosesFromStorage, savePosesToStorage, SavedPose } from '@/lib/gameData';

// Default poses for common letters (pre-trained basic ASL-like gestures)
const DEFAULT_POSES: Record<string, SavedPose> = {};

function initDefaultPoses(): Record<string, SavedPose> {
  // Basic finger patterns for common letters
  // thumb, index, middle, ring, pinky (0=curled, 1=extended)
  const patterns: Record<string, [number, number, number, number, number]> = {
    A: [0, 0, 0, 0, 0],  // Fist (all curled)
    B: [1, 1, 1, 1, 1],  // All fingers extended, flat hand
    C: [1, 0, 0, 0, 1],  // C shape - thumb and pinky extended
    D: [1, 1, 0, 0, 0],  // Index up, rest curled
    E: [0, 0, 0, 0, 1],  // All curled except pinky slightly out
    F: [1, 1, 1, 0, 0],  // Index and middle up, thumb touching them
    I: [0, 0, 0, 0, 1],  // Pinky up only
    K: [1, 1, 1, 0, 0],  // Index and middle up, thumb out
    L: [1, 1, 0, 0, 0],  // L shape - index up, thumb out
    M: [0, 0, 0, 0, 0],  // Three fingers over thumb
    N: [0, 0, 0, 0, 0],  // Two fingers over thumb
    O: [0, 0, 0, 0, 0],  // All fingertips touching thumb (circle)
    P: [1, 1, 0, 0, 0],  // Like K but pointing down
    Q: [1, 1, 0, 0, 0],  // Like G but pointing down
    R: [0, 1, 1, 0, 0],  // Index and middle crossed
    S: [0, 0, 0, 0, 0],  // Fist thumb over fingers
    T: [0, 0, 0, 0, 0],  // Thumb between index and middle
    U: [0, 1, 1, 0, 0],  // Index and middle up together
    V: [0, 1, 1, 0, 0],  // Peace sign
    W: [0, 1, 1, 1, 0],  // Index, middle, ring up
    Y: [1, 0, 0, 0, 1],  // Thumb and pinky out (hang loose)
  };

  const poses: Record<string, SavedPose> = {};
  for (const [letter, fingers] of Object.entries(patterns)) {
    poses[letter] = {
      letter,
      features: {
        thumb: fingers[0],
        index: fingers[1],
        middle: fingers[2],
        ring: fingers[3],
        pinky: fingers[4],
        thumbAngle: 0,
        indexAngle: 0,
        wristHeight: 0.5,
      },
      landmarks: [],
      isMovement: false,
      createdAt: Date.now(),
    };
  }
  return poses;
}

function getInitialData() {
  const score = loadScore();
  const progress = loadProgress();
  const unlocked = [1];
  for (const p of progress) {
    if (p.completed) {
      unlocked.push(p.levelId + 1);
    }
  }
  const poses = loadPosesFromStorage();
  if (Object.keys(poses).length === 0) {
    const defaults = initDefaultPoses();
    savePosesToStorage(defaults);
    return { score, unlocked, posesCount: Object.keys(defaults).length };
  }
  return { score, unlocked, posesCount: Object.keys(poses).length };
}

export default function Home() {
  const initial = typeof window !== 'undefined' ? getInitialData() : { score: 0, unlocked: [1], posesCount: 0 };
  const [view, setView] = useState<AppView>('menu');
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [totalScore, setTotalScore] = useState(initial.score);
  const [unlockedLevels, setUnlockedLevels] = useState<number[]>(initial.unlocked);
  const [savedPosesCount, setSavedPosesCount] = useState(initial.posesCount);

  const handleLevelComplete = (levelId: number, score: number) => {
    setTotalScore((prev) => prev + score);
    const nextLevel = levelId + 1;
    if (nextLevel <= LEVELS.length && !unlockedLevels.includes(nextLevel)) {
      setUnlockedLevels((prev) => [...prev, nextLevel]);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <AnimatePresence mode="wait">
        {view === 'menu' && (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50"
          >
            {/* Hero */}
            <main className="flex-1 flex items-center justify-center px-4 py-12">
              <div className="max-w-lg w-full text-center">
                {/* Logo / Icon */}
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

                {/* Action Buttons */}
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

                {/* Stats */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="mt-10 grid grid-cols-2 gap-4"
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
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                      </svg>
                      <span className="text-xs text-muted-foreground">Señas guardadas</span>
                    </div>
                    <div className="text-2xl font-bold">{savedPosesCount}</div>
                  </Card>
                </motion.div>
              </div>
            </main>

            {/* Footer */}
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
            className="min-h-screen flex flex-col bg-gradient-to-b from-orange-50 to-amber-50"
          >
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-orange-100">
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
                  const progress = loadProgress();
                  const levelProgress = progress.find((p) => p.levelId === level.id);
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

                        {/* Progress bar */}
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
