'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import CameraView from './CameraView';
import { HandLandmark, FeatureVector, SavedPose } from '@/lib/types';
import { getLetters, LEVELS, MOVEMENT_LETTERS } from '@/lib/gameData';
import { loadPosesFromStorage, saveScore, loadScore, loadProgress, saveProgress, LevelProgress } from '@/lib/gestureEngine';

interface GameModeProps {
  levelId: number;
  onBack: () => void;
  onLevelComplete: (levelId: number, score: number) => void;
}

export default function GameMode({ levelId, onBack, onLevelComplete }: GameModeProps) {
  const level = LEVELS.find((l) => l.id === levelId);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentLetterIndex, setCurrentLetterIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [totalScore, setTotalScore] = useState(loadScore());
  const [completedWords, setCompletedWords] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [gameComplete, setGameComplete] = useState(false);
  const [savedPoses, setSavedPoses] = useState<Record<string, SavedPose>>(() =>
    typeof window !== 'undefined' ? loadPosesFromStorage() : {}
  );
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [detectedLetter, setDetectedLetter] = useState<string | null>(null);
  const [currentMovement, setCurrentMovement] = useState<string | null>(null);
  const movementFramesRef = useRef<FeatureVector[]>([]);
  const lastLandmarksRef = useRef<HandLandmark[]>([]);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentWord = level?.words[currentWordIndex] || '';
  const letters = getLetters(currentWord);
  const currentLetter = letters[currentLetterIndex] || '';
  const isMovementLetter = !!MOVEMENT_LETTERS[currentLetter];

  // Handle landmarks for movement tracking
  const handleLandmarks = (landmarks: HandLandmark[], features: FeatureVector) => {
    lastLandmarksRef.current = landmarks;
    movementFramesRef.current.push(features);
    if (movementFramesRef.current.length > 30) {
      movementFramesRef.current.shift();
    }
  };

  // Handle movement detection
  const handleMovementDetected = (movementType: string) => {
    setCurrentMovement(movementType);
  };

  // Gesture detection handler
  const handleGestureDetected = (letter: string, confidence: number) => {
    if (!currentLetter || gameComplete) return;

    setDetectedLetter(letter);

    if (letter === currentLetter) {
      setFeedback('correct');
      const points = 10 + Math.round(confidence * 10);
      setScore((prev) => prev + points);
      setTotalScore((prev) => prev + points);

      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedback(null);

        if (currentLetterIndex < letters.length - 1) {
          setCurrentLetterIndex((prev) => prev + 1);
        } else {
          const newCompleted = [...completedWords, currentWord];
          setCompletedWords(newCompleted);
          setShowHint(false);

          if (currentWordIndex < (level?.words.length || 0) - 1) {
            setCurrentWordIndex((prev) => prev + 1);
            setCurrentLetterIndex(0);
          } else {
            setGameComplete(true);
            saveScore(totalScore + points);
            const progress = loadProgress();
            const existing = progress.findIndex((p) => p.levelId === levelId);
            const newProgress: LevelProgress = {
              levelId,
              completed: true,
              completedWords: newCompleted,
              bestScore: Math.max(score + points, progress[existing]?.bestScore || 0),
            };
            if (existing >= 0) {
              progress[existing] = newProgress;
            } else {
              progress.push(newProgress);
            }
            saveProgress(progress);
            onLevelComplete(levelId, score + points);
          }
        }
      }, 800);
    } else {
      if (feedback !== 'wrong') {
        setFeedback('wrong');
        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = setTimeout(() => {
          setFeedback(null);
        }, 500);
      }
    }
  };

  // Keyboard fallback for testing / accessibility
  useEffect(() => {
    function handleKeyPress(e: KeyboardEvent) {
      if (gameComplete) return;
      const key = e.key.toUpperCase();
      if (key === currentLetter) {
        handleGestureDetected(key, 0.95);
      }
    }
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentLetter, gameComplete]);

  const handleRestart = () => {
    setCurrentWordIndex(0);
    setCurrentLetterIndex(0);
    setScore(0);
    setCompletedWords([]);
    setFeedback(null);
    setShowHint(false);
    setGameComplete(false);
  };

  const hasPosesForLetter = (letter: string) => {
    return !!savedPoses[letter];
  };

  if (!level) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Nivel no encontrado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-orange-50 to-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-orange-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={onBack} className="gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </Button>
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-semibold">
              Nivel {level.id}
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="font-bold text-lg">{score}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 flex flex-col lg:flex-row gap-6">
        {/* Left: Camera */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="relative aspect-[4/3] max-h-[70vh]">
            <CameraView
              onGestureDetected={handleGestureDetected}
              onLandmarksDetected={handleLandmarks}
              onMovementDetected={handleMovementDetected}
              onReady={() => setIsCameraReady(true)}
              onLoadingChange={() => {}}
              isActive={!gameComplete}
              showCanvas={true}
            />

            {/* Feedback overlay */}
            <AnimatePresence>
              {feedback === 'correct' && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <div className="bg-green-500/90 backdrop-blur-sm rounded-full w-32 h-32 flex items-center justify-center">
                    <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </motion.div>
              )}
              {feedback === 'wrong' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-red-500/20 pointer-events-none rounded-2xl"
                />
              )}
            </AnimatePresence>
          </div>

          {/* Movement indicator */}
          {isMovementLetter && currentMovement && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-purple-100 text-purple-800 rounded-xl px-4 py-2 text-sm text-center"
            >
              Movimiento detectado: <span className="font-bold">{currentMovement}</span>
            </motion.div>
          )}

          {/* Hint text */}
          {showHint && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-blue-50 text-blue-800 rounded-xl px-4 py-3 text-sm"
            >
              <strong>Pista:</strong> Haz la seña de la letra{' '}
              <span className="font-bold text-lg">&quot;{currentLetter}&quot;</span>
              {MOVEMENT_LETTERS[currentLetter] && (
                <p className="mt-1 text-blue-600">{MOVEMENT_LETTERS[currentLetter].description}</p>
              )}
            </motion.div>
          )}
        </div>

        {/* Right: Game panel */}
        <div className="lg:w-80 flex flex-col gap-4">
          {/* Word progress */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">
                Palabra {currentWordIndex + 1} de {level.words.length}
              </span>
              <span className="text-sm text-muted-foreground">
                Puntaje total: {totalScore}
              </span>
            </div>
            <Progress
              value={((currentWordIndex + 1) / level.words.length) * 100}
              className="h-2"
            />
          </Card>

          {/* Current word display */}
          <Card className="p-6 bg-gradient-to-br from-orange-500 to-amber-500 text-white">
            <h3 className="text-xs uppercase tracking-wider opacity-80 mb-2">
              Seña esta palabra
            </h3>
            <div className="flex flex-wrap gap-2 justify-center">
              {letters.map((letter, i) => (
                <motion.div
                  key={`${currentWordIndex}-${i}`}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{
                    scale: i === currentLetterIndex ? 1.2 : 1,
                    opacity: 1,
                  }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className={`w-14 h-14 flex items-center justify-center rounded-xl text-2xl font-bold transition-all ${
                    i < currentLetterIndex
                      ? 'bg-green-400 text-white shadow-lg shadow-green-400/30'
                      : i === currentLetterIndex
                        ? 'bg-white text-orange-600 shadow-lg shadow-white/30 ring-4 ring-white/50'
                        : 'bg-white/20 text-white/70'
                  }`}
                >
                  {i < currentLetterIndex ? (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    letter
                  )}
                </motion.div>
              ))}
            </div>

            {/* Show detected letter */}
            {detectedLetter && !feedback && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 text-center"
              >
                <span className="text-sm opacity-70">Detectado: </span>
                <span className="text-lg font-bold">{detectedLetter}</span>
              </motion.div>
            )}
          </Card>

          {/* Target letter */}
          <Card className="p-6">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Letra actual
            </h3>
            <div className="text-center">
              <motion.div
                key={currentLetter}
                initial={{ rotateY: -90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                className="inline-block bg-orange-100 text-orange-700 rounded-2xl w-20 h-20 flex items-center justify-center text-4xl font-bold mb-3"
              >
                {currentLetter}
              </motion.div>
              {isMovementLetter && (
                <p className="text-xs text-purple-600 bg-purple-50 rounded-lg px-2 py-1 inline-block">
                  ✨ Letra con movimiento
                </p>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setShowHint(!showHint)}
              >
                {showHint ? 'Ocultar pista' : 'Mostrar pista'}
              </Button>
              {!hasPosesForLetter(currentLetter) && (
                <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-2 py-1 flex items-center">
                  ⚠️ Sin seña
                </div>
              )}
            </div>
          </Card>

          {/* Stats */}
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">{completedWords.length}</div>
                <div className="text-xs text-muted-foreground">Completadas</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{level.words.length - completedWords.length}</div>
                <div className="text-xs text-muted-foreground">Restantes</div>
              </div>
            </div>
          </Card>
        </div>
      </main>

      {/* Level Complete Modal */}
      <AnimatePresence>
        {gameComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full text-center"
            >
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold mb-2">¡Nivel Completado!</h2>
              <p className="text-muted-foreground mb-6">
                Completaste todas las palabras del nivel {level.id}
              </p>
              <div className="bg-orange-50 rounded-xl p-4 mb-6">
                <div className="text-3xl font-bold text-orange-600">{score}</div>
                <div className="text-sm text-orange-600/70">Puntos obtenidos</div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleRestart} className="flex-1">
                  Repetir
                </Button>
                <Button onClick={onBack} className="flex-1 bg-orange-500 hover:bg-orange-600">
                  Continuar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
