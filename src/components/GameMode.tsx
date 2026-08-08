'use client';

import React, { useState, useEffect, useRef, startTransition, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import CameraView from './CameraView';
import { HandLandmark, FeatureVector, SavedPose } from '@/lib/types';
import { getLetters, LEVELS, MOVEMENT_LETTERS } from '@/lib/gameData';
import {
  recognizeGesture,
  recognizeMovement,
  getLetterConfidence,
  loadPosesFromStorage,
  saveScore,
  loadScore,
  loadProgress,
  saveProgress,
  LevelProgress,
} from '@/lib/gestureEngine';

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
  const [totalScore, setTotalScore] = useState(0);
  const [completedWords, setCompletedWords] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [gameComplete, setGameComplete] = useState(false);
  const [savedPoses, setSavedPoses] = useState<Record<string, SavedPose>>({});

  // Real-time detection state
  const [detectedLetter, setDetectedLetter] = useState<string | null>(null);
  const [detectedConfidence, setDetectedConfidence] = useState(0);
  const [targetConfidence, setTargetConfidence] = useState(0);

  const [isCameraReady, setIsCameraReady] = useState(false);
  const movementHistoryRef = useRef<HandLandmark[][]>([]);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Gesture stabilization
  const stableLetterRef = useRef<string>('');
  const stableCountRef = useRef<number>(0);
  const lastConfirmTimeRef = useRef<number>(0);

  useEffect(() => {
    const poses = loadPosesFromStorage();
    const sc = loadScore();
    const progress = loadProgress();
    const levelProgress = progress.find((p) => p.levelId === levelId);
    startTransition(() => {
      setSavedPoses(poses);
      setTotalScore(sc);
      setScore(levelProgress?.bestScore || 0);
      setCompletedWords(levelProgress?.completedWords || []);
    });
  }, [levelId]);

  const currentWord = level?.words[currentWordIndex] || '';
  const letters = getLetters(currentWord);
  const currentLetter = letters[currentLetterIndex] || '';
  const isMovementLetter = !!MOVEMENT_LETTERS[currentLetter];

  // Handle incoming landmarks: run recognition
  const handleLandmarks = useCallback(
    (landmarks: HandLandmark[], _features: FeatureVector) => {
      if (!currentLetter || gameComplete || savedPoses === null) return;

      // Check if this is a movement letter
      if (isMovementLetter && movementHistoryRef.current.length >= 8) {
        const movResult = recognizeMovement(movementHistoryRef.current, savedPoses);
        if (movResult) {
          setDetectedLetter(movResult.letter);
          setDetectedConfidence(Math.round(movResult.confidence * 100));
          // Also calculate target confidence for movement
          const movTarget = getLetterConfidence(landmarks, currentLetter, savedPoses);
          setTargetConfidence(Math.round(movTarget * 100));
        } else {
          setDetectedLetter(null);
          setDetectedConfidence(0);
        }
      } else if (!isMovementLetter) {
        // Static recognition using 21 coordinates
        const result = recognizeGesture(landmarks, savedPoses);
        if (result) {
          setDetectedLetter(result.letter);
          setDetectedConfidence(Math.round(result.confidence * 100));
        } else {
          setDetectedLetter(null);
          setDetectedConfidence(0);
        }
        // Calculate how close to target letter
        const targetConf = getLetterConfidence(landmarks, currentLetter, savedPoses);
        setTargetConfidence(Math.round(targetConf * 100));
      }
    },
    [currentLetter, gameComplete, savedPoses, isMovementLetter]
  );

  // Handle movement history updates
  const handleMovementHistory = useCallback((frames: HandLandmark[][]) => {
    movementHistoryRef.current = frames;
  }, []);

  // Confirm gesture after stabilization
  const confirmGesture = useCallback(
    (letter: string, confidence: number) => {
      if (!currentLetter || gameComplete) return;

      const now = Date.now();
      if (now - lastConfirmTimeRef.current < 1500) return;

      if (letter === stableLetterRef.current) {
        stableCountRef.current++;
      } else {
        stableLetterRef.current = letter;
        stableCountRef.current = 1;
      }

      // Require 6 stable detections to confirm
      if (stableCountRef.current >= 6) {
        lastConfirmTimeRef.current = now;
        stableCountRef.current = 0;

        if (letter === currentLetter) {
          setFeedback('correct');
          const points = 10 + Math.round(confidence * 10);
          setScore((prev) => prev + points);
          setTotalScore((prev) => prev + points);

          if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
          feedbackTimeoutRef.current = setTimeout(() => {
            setFeedback(null);
            setDetectedLetter(null);
            setDetectedConfidence(0);
            setTargetConfidence(0);

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
                const newProg: LevelProgress = {
                  levelId,
                  completed: true,
                  completedWords: newCompleted,
                  bestScore: Math.max(score + points, progress[existing]?.bestScore || 0),
                };
                if (existing >= 0) {
                  progress[existing] = newProg;
                } else {
                  progress.push(newProg);
                }
                saveProgress(progress);
                onLevelComplete(levelId, score + points);
              }
            }
          }, 800);
        } else {
          // Wrong letter
          if (feedback !== 'wrong') {
            setFeedback('wrong');
            if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
            feedbackTimeoutRef.current = setTimeout(() => {
              setFeedback(null);
            }, 500);
          }
        }
      }
    },
    [currentLetter, gameComplete, currentLetterIndex, letters, currentWordIndex, currentWord, completedWords, level, totalScore, score, onLevelComplete]
  );

  // Trigger confirmation when detected letter is stable
  useEffect(() => {
    if (detectedLetter && detectedConfidence >= 45) {
      confirmGesture(detectedLetter, detectedConfidence);
    }
  }, [detectedLetter, detectedConfidence, confirmGesture]);

  // Keyboard fallback
  useEffect(() => {
    function handleKeyPress(e: KeyboardEvent) {
      if (gameComplete) return;
      const key = e.key.toUpperCase();
      if (key === currentLetter) {
        stableLetterRef.current = key;
        stableCountRef.current = 6; // Auto-confirm on keyboard
        confirmGesture(key, 95);
      }
    }
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentLetter, gameComplete, confirmGesture]);

  const handleRestart = () => {
    setCurrentWordIndex(0);
    setCurrentLetterIndex(0);
    setScore(0);
    setCompletedWords([]);
    setFeedback(null);
    setShowHint(false);
    setGameComplete(false);
    setDetectedLetter(null);
    setDetectedConfidence(0);
    setTargetConfidence(0);
  };

  const hasPosesForLetter = (letter: string) => {
    const pose = savedPoses[letter];
    return pose && !pose.isMovement && pose.samples.length > 0;
  };

  if (!level) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Nivel no encontrado</p>
      </div>
    );
  }

  // Confidence color based on value
  const getConfidenceColor = (val: number) => {
    if (val >= 70) return 'text-green-500';
    if (val >= 45) return 'text-yellow-500';
    return 'text-red-400';
  };

  const getConfidenceBarColor = (val: number) => {
    if (val >= 70) return 'bg-green-500';
    if (val >= 45) return 'bg-yellow-500';
    return 'bg-red-400';
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-orange-50 to-amber-50 dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-orange-100 dark:border-gray-700">
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
              onLandmarksDetected={handleLandmarks}
              onMovementHistory={handleMovementHistory}
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
          {/* ====== REAL-TIME DETECTION PANEL ====== */}
          <Card className="p-4 border-2 border-orange-200">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-bold">
              Detección en tiempo real
            </h4>

            {/* Target letter */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Letra objetivo</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-orange-400/30">
                  {currentLetter}
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-1">Similitud con objetivo</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-200 ${getConfidenceBarColor(targetConfidence)}`}
                        style={{ width: `${targetConfidence}%` }}
                      />
                    </div>
                    <span className={`text-sm font-bold min-w-[36px] text-right ${getConfidenceColor(targetConfidence)}`}>
                      {targetConfidence}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-gray-200 my-2" />

            {/* Detected letter */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Letra detectada</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold transition-all ${
                  detectedLetter
                    ? detectedLetter === currentLetter
                      ? 'bg-green-500 text-white shadow-lg shadow-green-400/30'
                      : 'bg-purple-500 text-white shadow-lg shadow-purple-400/30'
                    : 'bg-gray-200 text-gray-400'
                }`}>
                  {detectedLetter || '?'}
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-1">Confianza</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-200 ${
                          detectedLetter
                            ? getConfidenceBarColor(detectedConfidence)
                            : 'bg-gray-300'
                        }`}
                        style={{ width: `${detectedLetter ? detectedConfidence : 0}%` }}
                      />
                    </div>
                    <span className={`text-sm font-bold min-w-[36px] text-right ${
                      detectedLetter ? getConfidenceColor(detectedConfidence) : 'text-gray-400'
                    }`}>
                      {detectedLetter ? `${detectedConfidence}%` : '--'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status message */}
            {!hasPosesForLetter(currentLetter) && (
              <div className="mt-3 bg-amber-50 text-amber-700 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                </svg>
                No hay seña entrenada para &quot;{currentLetter}&quot;. Ve al modo Entrenamiento.
              </div>
            )}
          </Card>

          {/* Word progress */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
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
          <Card className="p-5 bg-gradient-to-br from-orange-500 to-amber-500 text-white">
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
                  className={`w-12 h-12 flex items-center justify-center rounded-xl text-xl font-bold transition-all ${
                    i < currentLetterIndex
                      ? 'bg-green-400 text-white shadow-lg shadow-green-400/30'
                      : i === currentLetterIndex
                        ? 'bg-white text-orange-600 shadow-lg shadow-white/30 ring-4 ring-white/50'
                        : 'bg-white/20 text-white/70'
                  }`}
                >
                  {i < currentLetterIndex ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    letter
                  )}
                </motion.div>
              ))}
            </div>
          </Card>

          {/* Target letter detail */}
          <Card className="p-4">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Letra actual
            </h3>
            <div className="flex items-center justify-between">
              <motion.div
                key={currentLetter}
                initial={{ rotateY: -90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                className="inline-block bg-orange-100 text-orange-700 rounded-xl w-16 h-16 flex items-center justify-center text-3xl font-bold"
              >
                {currentLetter}
              </motion.div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHint(!showHint)}
                >
                  {showHint ? 'Ocultar pista' : 'Pista'}
                </Button>
              </div>
            </div>
            {isMovementLetter && (
              <p className="text-xs text-purple-600 bg-purple-50 rounded-lg px-2 py-1 mt-2">
                ✨ Letra con movimiento
              </p>
            )}
          </Card>

          {/* Stats */}
          <Card className="p-3">
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
              className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full text-center"
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
