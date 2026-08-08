'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CameraView from './CameraView';
import { HandLandmark, FeatureVector, SavedPose, MovementType } from '@/lib/types';
import { MOVEMENT_LETTERS } from '@/lib/gameData';
import { loadPosesFromStorage, savePoseToStorage, deletePoseFromStorage, detectMovement } from '@/lib/gestureEngine';

interface TrainingModeProps {
  onBack: () => void;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function TrainingMode({ onBack }: TrainingModeProps) {
  const [selectedLetter, setSelectedLetter] = useState('A');
  const [savedPoses, setSavedPoses] = useState<Record<string, SavedPose>>({});
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureCountdown, setCaptureCountdown] = useState<number | null>(null);
  const [isRecordingMovement, setIsRecordingMovement] = useState(false);
  const [recordedFrames, setRecordedFrames] = useState<FeatureVector[]>([]);
  const [movementType, setMovementType] = useState<MovementType>('none');
  const [cameraReady, setCameraReady] = useState(false);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [currentLandmarks, setCurrentLandmarks] = useState<HandLandmark[]>([]);
  const [currentFeatures, setCurrentFeatures] = useState<FeatureVector | null>(null);
  const recordingRef = useRef<FeatureVector[]>([]);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Safe: loadPosesFromStorage checks typeof window
    setSavedPoses(loadPosesFromStorage());
  }, []);

  const refreshPoses = useCallback(() => {
    setSavedPoses(loadPosesFromStorage());
  }, []);

  const handleLandmarks = useCallback(
    (landmarks: HandLandmark[], features: FeatureVector) => {
      setCurrentLandmarks(landmarks);
      setCurrentFeatures(features);

      if (isRecordingMovement) {
        recordingRef.current.push(features);
        setRecordedFrames([...recordingRef.current]);
      }
    },
    [isRecordingMovement]
  );

  // Capture a static pose
  const capturePose = () => {
    if (!currentFeatures || !currentLandmarks.length) return;

    const pose: SavedPose = {
      letter: selectedLetter,
      features: currentFeatures,
      landmarks: currentLandmarks,
      isMovement: false,
      createdAt: Date.now(),
    };

    savePoseToStorage(pose);
    refreshPoses();
    setShowSuccess(selectedLetter);
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    successTimeoutRef.current = setTimeout(() => setShowSuccess(null), 2000);
  };

  // Start countdown then capture
  const startCapture = () => {
    setCaptureCountdown(3);
    let count = 3;
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      count--;
      if (count <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        setCaptureCountdown(null);
        capturePose();
      } else {
        setCaptureCountdown(count);
      }
    }, 1000);
  };

  // Start recording movement
  const startMovementRecording = () => {
    recordingRef.current = [];
    setRecordedFrames([]);
    setIsRecordingMovement(true);
  };

  // Stop recording and save movement
  const stopMovementRecording = () => {
    setIsRecordingMovement(false);

    if (recordingRef.current.length >= 5) {
      const detectedMovement = detectMovement(recordingRef.current) as MovementType;
      setMovementType(detectedMovement);

      // Save the average features as the base pose + movement info
      const avgFeatures = recordingRef.current.reduce(
        (acc, f) => ({
          thumb: acc.thumb + f.thumb,
          index: acc.index + f.index,
          middle: acc.middle + f.middle,
          ring: acc.ring + f.ring,
          pinky: acc.pinky + f.pinky,
          thumbAngle: acc.thumbAngle + f.thumbAngle,
          indexAngle: acc.indexAngle + f.indexAngle,
          wristHeight: acc.wristHeight + f.wristHeight,
        }),
        { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0, thumbAngle: 0, indexAngle: 0, wristHeight: 0 }
      );

      const n = recordingRef.current.length;
      const normalizedFeatures: FeatureVector = {
        thumb: avgFeatures.thumb / n,
        index: avgFeatures.index / n,
        middle: avgFeatures.middle / n,
        ring: avgFeatures.ring / n,
        pinky: avgFeatures.pinky / n,
        thumbAngle: avgFeatures.thumbAngle / n,
        indexAngle: avgFeatures.indexAngle / n,
        wristHeight: avgFeatures.wristHeight / n,
      };

      const pose: SavedPose = {
        letter: selectedLetter,
        features: normalizedFeatures,
        landmarks: currentLandmarks,
        isMovement: true,
        movementType: detectedMovement,
        movementFrames: recordingRef.current,
        createdAt: Date.now(),
      };

      savePoseToStorage(pose);
      refreshPoses();
      setShowSuccess(selectedLetter);
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = setTimeout(() => setShowSuccess(null), 2000);
    } else {
      setMovementType('none');
    }
  };

  const deletePose = (letter: string) => {
    deletePoseFromStorage(letter);
    refreshPoses();
    if (letter === selectedLetter) {
      setCurrentFeatures(null);
      setCurrentLandmarks([]);
    }
  };

  const isMovementLetter = !!MOVEMENT_LETTERS[selectedLetter];
  const hasPose = !!savedPoses[selectedLetter];
  const savedPose = savedPoses[selectedLetter];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-purple-50 to-violet-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-purple-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={onBack} className="gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </Button>
          <h1 className="text-lg font-bold text-purple-800">Modo Entrenamiento</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 flex flex-col lg:flex-row gap-6">
        {/* Left: Camera */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="relative aspect-[4/3] max-h-[65vh]">
            <CameraView
              onLandmarksDetected={handleLandmarks}
              isActive={true}
              onReady={() => setCameraReady(true)}
              onLoadingChange={() => {}}
              showCanvas={true}
            />

            {/* Countdown overlay */}
            <AnimatePresence>
              {captureCountdown !== null && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <div className="bg-black/50 backdrop-blur-sm rounded-full w-28 h-28 flex items-center justify-center">
                    <span className="text-white text-5xl font-bold">{captureCountdown}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Recording indicator */}
            {isRecordingMovement && (
              <div className="absolute top-3 right-3 flex items-center gap-2 bg-red-500/90 backdrop-blur-sm rounded-full px-3 py-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                <span className="text-white text-xs font-medium">
                  Grabando... {recordedFrames.length} frames
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
                      Seña guardada: {showSuccess}
                    </p>
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
                  disabled={!cameraReady || !currentLandmarks.length || captureCountdown !== null}
                  className="flex-1 bg-purple-500 hover:bg-purple-600"
                >
                  {captureCountdown !== null
                    ? `Capturando en ${captureCountdown}...`
                    : currentLandmarks.length
                      ? 'Capturar Seña Estática'
                      : 'Muestra tu mano'}
                </Button>
              )}
              {isMovementLetter && (
                <>
                  <Button
                    onClick={isRecordingMovement ? stopMovementRecording : startMovementRecording}
                    disabled={!cameraReady || !currentLandmarks.length}
                    variant={isRecordingMovement ? 'destructive' : 'default'}
                    className={`flex-1 ${!isRecordingMovement ? 'bg-purple-500 hover:bg-purple-600' : ''}`}
                  >
                    {isRecordingMovement
                      ? 'Detener Grabación'
                      : 'Grabar Movimiento'}
                  </Button>
                </>
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
            {isRecordingMovement && recordedFrames.length > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Frames grabados</span>
                  <span>{recordedFrames.length}</span>
                </div>
                <div className="w-full bg-purple-100 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (recordedFrames.length / 30) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-purple-500 mt-1">
                  {recordedFrames.length < 10
                    ? 'Sigue moviendo la mano...'
                    : recordedFrames.length < 20
                      ? 'Bien, sigue un poco más...'
                      : '¡Excelente! Puedes detener cuando quieras'}
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* Right: Alphabet and pose info */}
        <div className="lg:w-96 flex flex-col gap-4">
          {/* Selected letter info */}
          <Card className="p-6 bg-gradient-to-br from-purple-500 to-violet-500 text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs uppercase tracking-wider opacity-80">
                Letra seleccionada
              </h3>
              {hasPose && (
                <Badge variant="secondary" className="bg-white/20 text-white border-0">
                  {savedPose?.isMovement ? 'Con movimiento' : 'Estática'}
                </Badge>
              )}
            </div>
            <motion.div
              key={selectedLetter}
              initial={{ rotateY: -90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              className="text-7xl font-bold text-center py-4"
            >
              {selectedLetter}
            </motion.div>
            {hasPose && savedPose?.isMovement && (
              <p className="text-center text-sm opacity-80 mt-2">
                Movimiento: {savedPose?.movementType}
              </p>
            )}
            {hasPose && (
              <p className="text-center text-xs opacity-60 mt-1">
                Guardada el {new Date(savedPose!.createdAt).toLocaleDateString('es')}
              </p>
            )}
          </Card>

          {/* Current features preview */}
          {currentFeatures && currentLandmarks.length > 0 && (
            <Card className="p-4">
              <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                Pose detectada en tiempo real
              </h4>
              <div className="grid grid-cols-5 gap-2">
                {(['thumb', 'index', 'middle', 'ring', 'pinky'] as const).map((finger) => (
                  <div key={finger} className="text-center">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${
                        currentFeatures[finger] > 0.5
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {currentFeatures[finger] > 0.5 ? '↑' : '↓'}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 capitalize">
                      {finger === 'thumb' ? 'Pulgar' : finger === 'index' ? 'Índice' : finger === 'middle' ? 'Medio' : finger === 'ring' ? 'Anular' : 'Meñique'}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Alphabet grid */}
          <Card className="p-4">
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">
              Alfabeto
              <span className="ml-2 text-xs font-normal">
                ({Object.keys(savedPoses).length}/{ALPHABET.length} señas guardadas)
              </span>
            </h4>
            <div className="grid grid-cols-7 gap-1.5">
              {ALPHABET.map((letter) => {
                const hasSavedPose = !!savedPoses[letter];
                const isMovement = !!MOVEMENT_LETTERS[letter];
                const isSelected = letter === selectedLetter;

                return (
                  <motion.button
                    key={letter}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setSelectedLetter(letter);
                      setRecordedFrames([]);
                      setMovementType('none');
                      setIsRecordingMovement(false);
                    }}
                    className={`relative w-full aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition-all ${
                      isSelected
                        ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                        : hasSavedPose
                          ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {letter}
                    {hasSavedPose && !isSelected && (
                      <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border border-white" />
                    )}
                    {isMovement && (
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white ${isSelected ? 'bg-amber-300' : 'bg-amber-400'}`} title="Letra con movimiento" />
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                Guardada
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                Con movimiento
              </div>
            </div>
          </Card>

          {/* Actions */}
          <div className="flex gap-2">
            {hasPose && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deletePose(selectedLetter)}
                className="flex-1"
              >
                Eliminar seña de {selectedLetter}
              </Button>
            )}
          </div>

          {/* Tips */}
          <Card className="p-4 bg-amber-50 border-amber-200">
            <h4 className="text-sm font-semibold text-amber-800 mb-2">Consejos</h4>
            <ul className="text-xs text-amber-700 space-y-1.5">
              <li>• Mantén la mano centrada en la cámara</li>
              <li>• Usa buena iluminación para mejor detección</li>
              <li>• Para señas estáticas, mantén la pose firme 3 segundos</li>
              <li>• Para letras con movimiento (J, Z), haz el gesto completo</li>
              <li>• Guarda varias veces para mejorar la precisión</li>
            </ul>
          </Card>
        </div>
      </main>
    </div>
  );
}
