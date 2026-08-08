export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface FeatureVector {
  // Finger states: 0 = curled, 1 = extended
  thumb: number;
  index: number;
  middle: number;
  ring: number;
  pinky: number;
  // Additional features
  thumbAngle: number; // angle of thumb from palm center
  indexAngle: number; // angle between index and middle
  wristHeight: number; // normalized wrist position
}

export interface SavedPose {
  letter: string;
  features: FeatureVector;
  landmarks: HandLandmark[];
  isMovement: boolean;
  movementType?: 'horizontal' | 'vertical' | 'circular' | 'zigzag';
  movementFrames?: FeatureVector[];
  createdAt: number;
}

export interface Level {
  id: number;
  name: string;
  description: string;
  words: string[];
  requiredScore: number;
  unlocked: boolean;
}

export interface GameState {
  currentLevel: number;
  currentWordIndex: number;
  currentLetterIndex: number;
  score: number;
  completedWords: string[];
  mistakes: number;
  isPlaying: boolean;
}

export interface TrainingState {
  selectedLetter: string;
  isCapturing: boolean;
  isRecordingMovement: boolean;
  capturedFrames: FeatureVector[];
  savedPoses: Record<string, SavedPose>;
}

export type AppView = 'menu' | 'level-select' | 'game' | 'training';

export type MovementType = 'horizontal' | 'vertical' | 'circular' | 'zigzag' | 'none';
