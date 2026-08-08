'use client';

import React, { useEffect, useRef, useState } from 'react';
import { HandLandmark, FeatureVector } from '@/lib/types';
import { extractFeatures } from '@/lib/gestureEngine';

// Hand connections for drawing skeleton
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // Index
  [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
  [0, 13], [13, 14], [14, 15], [15, 16], // Ring
  [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
  [5, 9], [9, 13], [13, 17], [0, 17],   // Palm
];

// MediaPipe CDN URLs
const MEDIAPIPE_SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124/drawing_utils.js',
];

declare global {
  interface Window {
    Hands: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    HAND_CONNECTIONS: any;
  }
}

interface CameraViewProps {
  onGestureDetected?: (letter: string, confidence: number) => void;
  onLandmarksDetected?: (landmarks: HandLandmark[], features: FeatureVector) => void;
  onMovementDetected?: (movementType: string) => void;
  isActive?: boolean;
  showCanvas?: boolean;
  onLoadingChange?: (loading: boolean, error?: string) => void;
  onReady?: () => void;
  className?: string;
  continuousRecognition?: boolean;
}

export default function CameraView({
  onGestureDetected,
  onLandmarksDetected,
  onMovementDetected,
  isActive = true,
  showCanvas = true,
  onLoadingChange,
  onReady,
  className = '',
  continuousRecognition = true,
}: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mpHandsRef = useRef<any>(null);
  const mpCameraRef = useRef<any>(null);
  const animationRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHandDetected, setIsHandDetected] = useState(false);
  const [lastLandmarks, setLastLandmarks] = useState<HandLandmark[]>([]);
  const movementFramesRef = useRef<FeatureVector[]>([]);
  const lastGestureRef = useRef<string>('');
  const gestureStableCountRef = useRef<number>(0);
  const lastGestureTimeRef = useRef<number>(0);

  // Load MediaPipe scripts from CDN
  useEffect(() => {
    let cancelled = false;

    async function loadScripts() {
      try {
        onLoadingChange?.(true);

        for (const src of MEDIAPIPE_SCRIPTS) {
          await new Promise<void>((resolve, reject) => {
            // Check if already loaded
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
              resolve();
              return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.crossOrigin = 'anonymous';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(script);
          });
        }

        if (cancelled) return;

        // Small delay to ensure globals are available
        await new Promise((r) => setTimeout(r, 100));

        if (!window.Hands) {
          throw new Error('MediaPipe Hands no se cargó correctamente');
        }

        setIsLoaded(true);
        setIsLoading(false);
        onLoadingChange?.(false);
        onReady?.();
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.message || 'Error al cargar MediaPipe';
        setError(msg);
        setIsLoading(false);
        onLoadingChange?.(false, msg);
      }
    }

    loadScripts();

    return () => {
      cancelled = true;
    };
  }, []);

  // Initialize MediaPipe Hands and Camera
  useEffect(() => {
    if (!isLoaded || !videoRef.current || !isActive) return;

    let handsInstance: any = null;
    let cameraInstance: any = null;

    async function initHands() {
      const video = videoRef.current!;
      const canvas = canvasRef.current!;

      handsInstance = new window.Hands({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
      });

      handsInstance.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5,
      });

      handsInstance.onResults((results: any) => {
        const ctx = canvas.getContext('2d')!;

        // Clear and set canvas size
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw video frame mirrored
        if (showCanvas) {
          ctx.save();
          ctx.scale(-1, 1);
          ctx.translate(-canvas.width, 0);
          ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
          ctx.restore();
        }

        if (
          results.multiHandLandmarks &&
          results.multiHandLandmarks.length > 0
        ) {
          const landmarks: HandLandmark[] = results.multiHandLandmarks[0].map(
            (lm: any) => ({ x: lm.x, y: lm.y, z: lm.z })
          );

          setIsHandDetected(true);
          setLastLandmarks(landmarks);

          const features = extractFeatures(landmarks);
          onLandmarksDetected?.(landmarks, features);

          // Track movement frames
          movementFramesRef.current.push(features);
          if (movementFramesRef.current.length > 30) {
            movementFramesRef.current.shift();
          }

          // Detect movement
          if (movementFramesRef.current.length >= 10) {
            const movement = detectMovement(movementFramesRef.current);
            if (movement !== 'none') {
              onMovementDetected?.(movement);
            }
          }

          // Draw hand skeleton
          if (showCanvas && window.drawConnectors && window.drawLandmarks) {
            // Mirror the landmarks for drawing
            const mirroredLandmarks = landmarks.map((lm) => ({
              x: 1 - lm.x,
              y: lm.y,
              z: lm.z,
            }));

            window.drawConnectors(
              ctx,
              mirroredLandmarks,
              HAND_CONNECTIONS,
              { color: '#FF6B35', lineWidth: 3 }
            );
            window.drawLandmarks(ctx, mirroredLandmarks, {
              color: '#FFD23F',
              lineWidth: 1,
              radius: 4,
            });
          }
        } else {
          setIsHandDetected(false);
          setLastLandmarks([]);
          movementFramesRef.current = [];
        }
      });

      mpHandsRef.current = handsInstance;

      // Request camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
        });
        streamRef.current = stream;
        video.srcObject = stream;

        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            video.play();
            resolve();
          };
        });

        // Process frames
        const processFrame = async () => {
          if (video.readyState >= 2 && handsInstance) {
            await handsInstance.send({ image: video });
          }
          animationRef.current = requestAnimationFrame(processFrame);
        };

        processFrame();
      } catch (err: any) {
        setError('No se pudo acceder a la cámara. Verifica los permisos.');
        onLoadingChange?.(false, 'Camera access denied');
      }
    }

    initHands();

    return () => {
      cancelAnimationFrame(animationRef.current);
      if (cameraInstance) cameraInstance.stop();
      if (handsInstance) handsInstance.close();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isLoaded, isActive]);

  // Gesture stabilization: require N consistent detections
  const handleGestureDetection = useCallback(
    (letter: string, confidence: number) => {
      const now = Date.now();
      if (now - lastGestureTimeRef.current < 1500) return; // Cooldown

      if (letter === lastGestureRef.current) {
        gestureStableCountRef.current++;
      } else {
        lastGestureRef.current = letter;
        gestureStableCountRef.current = 1;
      }

      // Require 8 stable frames to confirm gesture
      if (gestureStableCountRef.current >= 8) {
        onGestureDetected?.(letter, confidence);
        lastGestureTimeRef.current = now;
        gestureStableCountRef.current = 0;
      }
    },
    [onGestureDetected]
  );

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      {/* Video element (hidden, used by MediaPipe) */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover opacity-0"
        playsInline
        muted
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Canvas for drawing */}
      <canvas
        ref={canvasRef}
        className={`w-full h-full rounded-2xl ${showCanvas ? '' : 'hidden'}`}
      />

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card rounded-2xl">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-400 border-t-transparent mb-4" />
          <p className="text-sm text-muted-foreground animate-pulse">
            Cargando cámara y modelo de manos...
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card rounded-2xl p-6">
          <svg className="w-16 h-16 text-destructive mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-destructive text-center mb-2">{error}</p>
          <p className="text-xs text-muted-foreground text-center">
            Asegúrate de permitir el acceso a la cámara
          </p>
        </div>
      )}

      {/* Hand detection indicator */}
      {isLoaded && !error && (
        <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
          <div
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              isHandDetected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
            }`}
          />
          <span className="text-white text-xs font-medium">
            {isHandDetected ? 'Mano detectada' : 'Sin mano'}
          </span>
        </div>
      )}

      {/* No hand detected overlay */}
      {isLoaded && !error && !isHandDetected && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/40 backdrop-blur-sm rounded-xl px-6 py-4 text-center">
            <svg className="w-12 h-12 text-white/80 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
            </svg>
            <p className="text-white/80 text-sm">Muestra tu mano a la cámara</p>
          </div>
        </div>
      )}
    </div>
  );
}
