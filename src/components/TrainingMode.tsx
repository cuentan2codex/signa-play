'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CameraView from './CameraView';
import { HandLandmark, FeatureVector, SavedPose, MovementType } from '@/lib/types';
import { MOVEMENT_LETTERS } from '@/lib/gameData';
import {
  loadPosesFromStorage,
  savePoseToStorage,
  deletePoseFromStorage,
  deleteAllPosesFromStorage,
  getLetterConfidence,
  getMovementLetterConfidence,
  comparePoses,
  normalizeLandmarks,
} from '@/lib/gestureEngine';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useTheme } from 'next-themes';
import ThemeToggle from './ThemeToggle';

interface TrainingModeProps {
  onBack: () => void;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function TrainingMode({ onBack }: TrainingModeProps) {
  const [selectedLetter, setSelectedLetter] = useState('A');
  const [savedPoses, setSavedPoses] = useState<Record<string, SavedPose>>({});
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecordingMovement, setIsRecordingMovement] = useState(false);
  const [recordedFrameCount, setRecordedFrameCount] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [currentLandmarks, setCurrentLandmarks] = useState<HandLandmark[]>([]);
  // Real-time confidence against selected letter
  const [liveConfidence, setLiveConfidence] = useState(0);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const { theme, setTheme } = useTheme();

  const recordingRef = useRef<HandLandmark[][]>([]);
  const movementHistoryRef = useRef<HandLandmark[][]>([]);
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setSavedPoses(loadPosesFromStorage());
  }, []);

  const refreshPoses = useCallback(() => {
    setSavedPoses(loadPosesFromStorage());
  }, []);

  const isMovementLetter = !!MOVEMENT_LETTERS[selectedLetter];

  // Handle landmarks: update live confidence
  const handleLandmarks = useCallback(
    (landmarks: HandLandmark[], _features: FeatureVector) => {
      setCurrentLandmarks(landmarks);

      // Record movement frames if recording (auto-stop at 90 frames = 3s @ 30fps)
      if (isRecordingMovement) {
        recordingRef.current.push([...landmarks]);
        setRecordedFrameCount(recordingRef.current.length);
        if (recordingRef.current.length >= 90) {
          setIsRecordingMovement(false);
          // Save will be handled by useEffect below
        }
      }

      // Calculate live confidence against selected letter
      if (landmarks.length === 21) {
        if (isMovementLetter) {
          // For movement letters, confidence is based on trajectory history
          const conf = getMovementLetterConfidence(movementHistoryRef.current, selectedLetter, savedPoses);
          setLiveConfidence(Math.round(conf * 100));
        } else {
          const conf = getLetterConfidence(landmarks, selectedLetter, savedPoses);
          setLiveConfidence(Math.round(conf * 100));
        }
      }
    },
    [isRecordingMovement, isMovementLetter, selectedLetter, savedPoses]
  );

  // Track movement history from camera for live confidence
  const handleMovementHistory = useCallback(
    (frames: HandLandmark[][]) => {
      movementHistoryRef.current = frames;
    },
    []
  );

  // Capture a static pose sample (adds to existing samples)
  const capturePose = () => {
    if (!currentLandmarks.length || currentLandmarks.length !== 21) return;

    const existing = savedPoses[selectedLetter];
    const newSamples = existing
      ? [...existing.samples, [...currentLandmarks]]
      : [[...currentLandmarks]];

    const pose: SavedPose = {
      letter: selectedLetter,
      samples: newSamples,
      isMovement: false,
      createdAt: existing?.createdAt || Date.now(),
    };

    savePoseToStorage(pose);
    refreshPoses();
    setShowSuccess(selectedLetter);
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    successTimeoutRef.current = setTimeout(() => setShowSuccess(null), 2000);
  };

  // Capture immediately (no countdown)
  const startCapture = () => {
    capturePose();
  };

  // Auto-save movement when recording reaches 90 frames
  useEffect(() => {
    if (!isRecordingMovement && recordingRef.current.length >= 90) {
      const frames = recordingRef.current;
      recordingRef.current = [];

      const existing = savedPoses[selectedLetter];
      const newMovementSamples = existing?.movementSamples
        ? [...existing.movementSamples, frames]
        : [frames];

      const pose: SavedPose = {
        letter: selectedLetter,
        samples: existing?.samples || [],
        isMovement: true,
        movementType: MOVEMENT_LETTERS[selectedLetter]?.type as any,
        movementSamples: newMovementSamples,
        createdAt: existing?.createdAt || Date.now(),
      };

      savePoseToStorage(pose);
      refreshPoses();
      setShowSuccess(selectedLetter);
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = setTimeout(() => setShowSuccess(null), 2000);
    }
  }, [isRecordingMovement]);

  // Start recording movement (raw landmarks per frame)
  const startMovementRecording = () => {
    recordingRef.current = [];
    setRecordedFrameCount(0);
    setIsRecordingMovement(true);
  };

  // Stop recording and save movement
  const stopMovementRecording = () => {
    setIsRecordingMovement(false);

    if (recordingRef.current.length >= 8) {
      const existing = savedPoses[selectedLetter];
      const newMovementSamples = existing?.movementSamples
        ? [...existing.movementSamples, recordingRef.current]
        : [recordingRef.current];

      const pose: SavedPose = {
        letter: selectedLetter,
        samples: existing?.samples || [],
        isMovement: true,
        movementType: MOVEMENT_LETTERS[selectedLetter]?.type as any,
        movementSamples: newMovementSamples,
        createdAt: existing?.createdAt || Date.now(),
      };

      savePoseToStorage(pose);
      refreshPoses();
      setShowSuccess(selectedLetter);
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = setTimeout(() => setShowSuccess(null), 2000);
    }
  };

  // Delete last sample for selected letter
  const deleteLastSample = () => {
    const pose = savedPoses[selectedLetter];
    if (!pose) return;

    if (pose.isMovement && pose.movementSamples && pose.movementSamples.length > 0) {
      const updated = { ...pose, movementSamples: pose.movementSamples.slice(0, -1) };
      if (updated.movementSamples.length === 0) {
        deletePoseFromStorage(selectedLetter);
        setSavedPoses(loadPosesFromStorage());
      } else {
        savePoseToStorage(updated);
        refreshPoses();
      }
    } else if (pose.samples.length > 0) {
      const updated = { ...pose, samples: pose.samples.slice(0, -1) };
      if (updated.samples.length === 0) {
        deletePoseFromStorage(selectedLetter);
        setSavedPoses(loadPosesFromStorage());
      } else {
        savePoseToStorage(updated);
        refreshPoses();
      }
    }
  };

  // Delete all samples for selected letter
  const deleteAllSamples = () => {
    deletePoseFromStorage(selectedLetter);
    refreshPoses();
    setCurrentLandmarks([]);
    setLiveConfidence(0);
  };

  // Delete ALL samples from ALL letters
  const deleteAllGlobalSamples = () => {
    deleteAllPosesFromStorage();
    refreshPoses();
    setCurrentLandmarks([]);
    setLiveConfidence(0);
    setShowDeleteAllDialog(false);
  };

  const savedPose = savedPoses[selectedLetter];
  const hasPose = !!savedPose;
  const sampleCount = savedPose
    ? savedPose.isMovement
      ? savedPose.movementSamples?.length || 0
      : savedPose.samples.length
    : 0;

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
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-purple-50 to-violet-50 dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-purple-100 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={onBack} className="gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </Button>
          <h1 className="text-lg font-bold text-purple-800">Modo Entrenamiento</h1>
          {/* Theme controls */}
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowThemePicker(!showThemePicker)}
                className="gap-1.5 text-xs"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                Tema
              </Button>

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
                        'border-purple-400 dark:border-purple-500 bg-purple-50/50 dark:bg-purple-950/20',
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
                              style={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#7dd3fc' }}
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
                                  <svg className="w-2.5 h-2.5" style={{ color: '#0284c7' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
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
                              ? 'ring-2 ring-purple-400 ring-offset-1'
                              : 'opacity-50',
                          ].join(' ')}>
                            <div className="w-full h-full bg-gradient-to-br from-sky-50 via-sky-100 to-cyan-50" />
                          </div>
                          <div className={[
                            'flex-1 h-10 rounded-lg overflow-hidden relative transition-all',
                            theme === 'dark'
                              ? 'ring-2 ring-purple-500 ring-offset-1 ring-offset-gray-800'
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

          <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 gap-1.5 text-xs"
                disabled={Object.keys(savedPoses).length === 0}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Borrar todo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminar todas las muestras</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminarán todas las muestras de todas las letras ({Object.keys(savedPoses).length} letras con datos). Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={deleteAllGlobalSamples}
                  className="bg-red-500 hover:bg-red-600"
                >
                  Sí, eliminar todo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 flex flex-col lg:flex-row gap-6">
        {/* Left: Camera */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="relative aspect-[4/3] max-h-[40vh] lg:max-h-[65vh]">
            <CameraView
              onLandmarksDetected={handleLandmarks}
              onMovementHistory={handleMovementHistory}
              isActive={true}
              onReady={() => setCameraReady(true)}
              onLoadingChange={() => {}}
              showCanvas={true}
            />

            {/* Recording indicator */}
            {isRecordingMovement && (
              <div className="absolute top-3 right-3 flex items-center gap-2 bg-red-500/90 backdrop-blur-sm rounded-full px-3 py-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                <span className="text-white text-xs font-medium">
                  Grabando... {recordedFrameCount} frames
                </span>
              </div>
            )}

            {/* Success overlay */}
            <AnimatePresence>
              {showSuccess && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <div className="bg-green-500/90 backdrop-blur-sm rounded-2xl px-8 py-6 text-center">
                    <svg className="w-12 h-12 text-white mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-white text-lg font-bold">
                      Muestra guardada: {showSuccess}
                    </p>
                    <p className="text-white/80 text-sm">({sampleCount} {sampleCount === 1 ? 'muestra' : 'muestras'} total)</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Camera controls */}
          <Card className="p-4">
            <div className="flex gap-3">
              {!isMovementLetter && (
                <Button
                  onClick={startCapture}
                  disabled={!cameraReady || !currentLandmarks.length}
                  className="flex-1 bg-purple-500 hover:bg-purple-600"
                >
                  {currentLandmarks.length
                    ? `Capturar muestra (${sampleCount + 1})`
                    : 'Muestra tu mano'}
                </Button>
              )}
              {isMovementLetter && (
                <Button
                  onClick={isRecordingMovement ? stopMovementRecording : startMovementRecording}
                  disabled={!cameraReady || !currentLandmarks.length || (isRecordingMovement && recordedFrameCount >= 90)}
                  variant={isRecordingMovement ? 'destructive' : 'default'}
                  className={`flex-1 ${!isRecordingMovement ? 'bg-purple-500 hover:bg-purple-600' : ''}`}
                >
                  {isRecordingMovement
                    ? `Detener (${recordedFrameCount}/90)`
                    : `Grabar movimiento (${sampleCount + 1})`}
                </Button>
              )}
            </div>

            {/* Movement info */}
            {isMovementLetter && (
              <div className="mt-3 bg-purple-50 text-purple-700 rounded-lg p-3 text-sm">
                <strong>Letra con movimiento:</strong>{' '}
                {MOVEMENT_LETTERS[selectedLetter]?.description}
              </div>
            )}

            {/* Recording progress */}
            {isRecordingMovement && recordedFrameCount > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Frames grabados</span>
                  <span>{recordedFrameCount}</span>
                </div>
                <div className="w-full bg-purple-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${recordedFrameCount >= 90 ? 'bg-green-500' : 'bg-purple-500'}`}
                    style={{ width: `${Math.min(100, (recordedFrameCount / 90) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-purple-500 mt-1">
                  {recordedFrameCount >= 90
                    ? 'Grabación completa!'
                    : recordedFrameCount < 30
                      ? 'Sigue moviendo la mano...'
                      : recordedFrameCount < 60
                        ? 'Bien, sigue un poco más...'
                        : 'Ya casi, termina el gesto!'}
                </p>
              </div>
            )}
          </Card>

          {/* ====== LIVE CONFIDENCE PANEL ====== */}
          {currentLandmarks.length === 21 && (
            <Card className="p-4 border-2 border-purple-200">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-bold">
                Prueba en vivo
              </h4>
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-3xl font-bold ${
                  liveConfidence >= 70
                    ? 'bg-green-100 text-green-700'
                    : liveConfidence >= 45
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-500'
                }`}>
                  {liveConfidence}%
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Coincidencia con &quot;{selectedLetter}&quot;</span>
                    <span className={`font-bold ${getConfidenceColor(liveConfidence)}`}>
                      {liveConfidence >= 70 ? 'Excelente' : liveConfidence >= 45 ? 'Buena' : 'Baja'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-150 ${getConfidenceBarColor(liveConfidence)}`}
                      style={{ width: `${liveConfidence}%` }}
                    />
                  </div>
                  {sampleCount > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Comparando contra {sampleCount} {sampleCount === 1 ? 'muestra guardada' : 'muestras guardadas'}
                    </p>
                  )}
                  {sampleCount === 0 && (
                    <p className="text-xs text-sky-600 mt-1">
                      Captura al menos una muestra para ver la coincidencia
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right: Alphabet and pose info */}
        <div className="lg:w-96 flex flex-col gap-4">
          {/* Selected letter info */}
          <Card className="p-5 bg-gradient-to-br from-purple-500 to-violet-500 text-white">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-wider opacity-80">
                Letra seleccionada
              </h3>
              {hasPose && (
                <Badge variant="secondary" className="bg-white/20 text-white border-0">
                  {savedPose?.isMovement ? 'Con movimiento' : 'Estática'} · {sampleCount} {sampleCount === 1 ? 'muestra' : 'muestras'}
                </Badge>
              )}
            </div>
            <motion.div
              key={selectedLetter}
              initial={{ rotateY: -90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              className="text-7xl font-bold text-center py-3"
            >
              {selectedLetter}
            </motion.div>
            {hasPose && savedPose?.isMovement && (
              <p className="text-center text-sm opacity-80 mt-1">
                Movimiento: {savedPose?.movementType}
              </p>
            )}
            {sampleCount > 0 && (
              <p className="text-center text-xs opacity-60 mt-1">
                {sampleCount >= 5 ? 'Excelente cobertura' : sampleCount >= 3 ? 'Buena cobertura' : 'Agrega más muestras para mejorar precisión'}
              </p>
            )}
          </Card>

          {/* Sample actions */}
          {hasPose && (
            <Card className="p-3">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={deleteLastSample}
                  className="flex-1"
                  disabled={sampleCount <= 0}
                >
                  Borrar última muestra
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={deleteAllSamples}
                  className="flex-1"
                >
                  Borrar todo ({selectedLetter})
                </Button>
              </div>
            </Card>
          )}

          {/* Alphabet grid */}
          <Card className="p-4">
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">
              Alfabeto
              <span className="ml-2 text-xs font-normal">
                ({Object.keys(savedPoses).length}/{ALPHABET.length} letras entrenadas)
              </span>
            </h4>
            <div className="grid grid-cols-7 gap-1.5">
              {ALPHABET.map((letter) => {
                const pose = savedPoses[letter];
                const count = pose
                  ? pose.isMovement
                    ? pose.movementSamples?.length || 0
                    : pose.samples.length
                  : 0;
                const hasSavedPose = count > 0;
                const isMovement = !!MOVEMENT_LETTERS[letter];
                const isSelected = letter === selectedLetter;

                return (
                  <motion.button
                    key={letter}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setSelectedLetter(letter);
                      setRecordedFrameCount(0);
                      setIsRecordingMovement(false);
                      setLiveConfidence(0);
                    }}
                    className={`relative w-full aspect-square rounded-lg flex flex-col items-center justify-center text-sm font-bold transition-all ${
                      isSelected
                        ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                        : hasSavedPose
                          ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {letter}
                    {count > 0 && !isSelected && (
                      <span className="text-[9px] leading-none mt-0.5 opacity-70">{count}</span>
                    )}
                    {isSelected && count > 0 && (
                      <span className="text-[9px] leading-none mt-0.5 opacity-80">{count}</span>
                    )}
                    {isMovement && (
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${isSelected ? 'bg-amber-300' : 'bg-amber-400'}`} />
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                Entrenada (el número = muestras)
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                Con movimiento
              </div>
            </div>
          </Card>

          {/* Tips */}
          <Card className="p-4 bg-sky-50 border-amber-200">
            <h4 className="text-sm font-semibold text-sky-800 mb-2">Consejos</h4>
            <ul className="text-xs text-sky-700 space-y-1.5">
              <li>• <strong>Captura varias muestras</strong> de la misma letra (3-5 recomendado)</li>
              <li>• Variá ligeramente la posición entre cada captura</li>
              <li>• Mantén la mano centrada en la cámara</li>
              <li>• Usa buena iluminación para mejor detección</li>
              <li>• Para letras con movimiento (J, Z), grabá el gesto completo</li>
              <li>• Verificá la coincidencia en vivo antes de jugar</li>
            </ul>
          </Card>
        </div>
      </main>
    </div>
  );
}
