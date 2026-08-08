import { HandLandmark, FeatureVector, SavedPose, MovementType } from './types';

/**
 * Extract a feature vector from 21 hand landmarks.
 * Features are designed to be pose-invariant (size/position independent).
 */
export function extractFeatures(landmarks: HandLandmark[]): FeatureVector {
  // Finger tip and PIP indices
  const TIP = [4, 8, 12, 16, 20]; // thumb, index, middle, ring, pinky tips
  const PIP = [3, 6, 10, 14, 18]; // thumb IP, index PIP, middle PIP, ring PIP, pinky PIP
  const MCP = [2, 5, 9, 13, 17]; // thumb MCP, index MCP, middle MCP, ring MCP, pinky MCP
  const WRIST = 0;

  const fingerExtended: number[] = [];

  for (let i = 0; i < 5; i++) {
    const tip = landmarks[TIP[i]];
    const pip = landmarks[PIP[i]];
    const mcp = landmarks[MCP[i]];

    if (i === 0) {
      // Thumb: check if tip is far from index MCP (side of hand)
      const indexMcp = landmarks[5];
      const tipDist = Math.sqrt(
        (tip.x - indexMcp.x) ** 2 + (tip.y - indexMcp.y) ** 2
      );
      const mcpDist = Math.sqrt(
        (mcp.x - indexMcp.x) ** 2 + (mcp.y - indexMcp.y) ** 2
      );
      fingerExtended.push(tipDist > mcpDist * 1.2 ? 1 : 0);
    } else {
      // Other fingers: tip y < pip y means extended (in screen coords, y increases downward)
      fingerExtended.push(tip.y < pip.y ? 1 : 0);
    }
  }

  // Thumb angle relative to palm center
  const wrist = landmarks[WRIST];
  const middleMcp = landmarks[9];
  const palmCenter = {
    x: (wrist.x + middleMcp.x) / 2,
    y: (wrist.y + middleMcp.y) / 2,
  };
  const thumbTip = landmarks[4];
  const thumbAngle = Math.atan2(thumbTip.y - palmCenter.y, thumbTip.x - palmCenter.x);

  // Angle between index and middle fingers
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const indexAngle = Math.atan2(middleTip.y - indexTip.y, middleTip.x - indexTip.x);

  // Normalized wrist height
  const wristHeight = wrist.y;

  return {
    thumb: fingerExtended[0],
    index: fingerExtended[1],
    middle: fingerExtended[2],
    ring: fingerExtended[3],
    pinky: fingerExtended[4],
    thumbAngle,
    indexAngle,
    wristHeight,
  };
}

/**
 * Compare two feature vectors and return a similarity score (0-1, higher = more similar).
 */
export function compareFeatures(a: FeatureVector, b: FeatureVector): number {
  // Finger state matching (5 values)
  let fingerScore = 0;
  const fingerKeys: (keyof FeatureVector)[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
  for (const key of fingerKeys) {
    if (Math.abs(a[key] - b[key]) < 0.5) fingerScore++;
  }
  const fingerSimilarity = fingerScore / 5;

  // Angle similarity (normalized to 0-1)
  const angleSimilarity =
    1 - (Math.abs(a.thumbAngle - b.thumbAngle) / Math.PI) * 0.5 +
    1 - (Math.abs(a.indexAngle - b.indexAngle) / Math.PI) * 0.5;
  const angleScore = Math.min(1, angleSimilarity / 2);

  // Wrist height similarity
  const wristSimilarity = 1 - Math.abs(a.wristHeight - b.wristHeight);

  // Weighted average
  return fingerSimilarity * 0.6 + angleScore * 0.25 + wristSimilarity * 0.15;
}

/**
 * Detect movement type from a sequence of feature vectors.
 */
export function detectMovement(frames: FeatureVector[]): MovementType {
  if (frames.length < 5) return 'none';

  // Track wrist position changes
  const positions = frames.map((f) => ({ x: f.thumbAngle, y: f.wristHeight }));

  // Calculate dominant direction
  let totalDx = 0;
  let totalDy = 0;
  for (let i = 1; i < positions.length; i++) {
    totalDx += positions[i].x - positions[i - 1].x;
    totalDy += positions[i].y - positions[i - 1].y;
  }

  const avgDx = totalDx / (positions.length - 1);
  const avgDy = totalDy / (positions.length - 1);

  // Check for direction changes (zigzag)
  let directionChanges = 0;
  for (let i = 2; i < positions.length; i++) {
    const prevDx = positions[i - 1].x - positions[i - 2].x;
    const currDx = positions[i].x - positions[i - 1].x;
    if (prevDx * currDx < 0) directionChanges++;
  }

  if (directionChanges > positions.length / 3) return 'zigzag';
  if (Math.abs(avgDx) > Math.abs(avgDy) * 2) return 'horizontal';
  if (Math.abs(avgDy) > Math.abs(avgDx) * 2) return 'vertical';

  // Check for circular motion
  let crossCount = 0;
  for (let i = 2; i < positions.length; i++) {
    const dx1 = positions[i - 1].x - positions[i - 2].x;
    const dy1 = positions[i - 1].y - positions[i - 2].y;
    const dx2 = positions[i].x - positions[i - 1].x;
    const dy2 = positions[i].y - positions[i - 1].y;
    const cross = dx1 * dy2 - dy1 * dx2;
    if (cross > 0) crossCount++;
  }
  if (crossCount > positions.length / 4) return 'circular';

  return 'none';
}

/**
 * Recognize a gesture from the current landmarks by comparing with saved poses.
 */
export function recognizeGesture(
  currentLandmarks: HandLandmark[],
  savedPoses: Record<string, SavedPose>,
  movementFrames: FeatureVector[] = []
): { letter: string; confidence: number } | null {
  const currentFeatures = extractFeatures(currentLandmarks);
  let bestMatch: { letter: string; confidence: number } | null = null;

  for (const [letter, pose] of Object.entries(savedPoses)) {
    if (pose.isMovement) {
      // For movement-based poses, check movement type first
      if (movementFrames.length >= 5) {
        const detectedMovement = detectMovement(movementFrames);
        if (detectedMovement === pose.movementType) {
          // Then check static pose too
          const similarity = compareFeatures(currentFeatures, pose.features);
          if (!bestMatch || similarity > bestMatch.confidence) {
            bestMatch = { letter, confidence: similarity };
          }
        }
      }
    } else {
      // Static pose comparison
      const similarity = compareFeatures(currentFeatures, pose.features);
      if (!bestMatch || similarity > bestMatch.confidence) {
        bestMatch = { letter, confidence: similarity };
      }
    }
  }

  // Require minimum confidence threshold
  if (bestMatch && bestMatch.confidence > 0.5) {
    return bestMatch;
  }
  return null;
}

// localStorage management
const STORAGE_KEY = 'sign-language-poses';

export function savePosesToStorage(poses: Record<string, SavedPose>): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(poses));
  }
}

export function loadPosesFromStorage(): Record<string, SavedPose> {
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      try {
        return JSON.parse(data);
      } catch {
        return {};
      }
    }
  }
  return {};
}

export function savePoseToStorage(pose: SavedPose): void {
  const poses = loadPosesFromStorage();
  poses[pose.letter] = pose;
  savePosesToStorage(poses);
}

export function deletePoseFromStorage(letter: string): void {
  const poses = loadPosesFromStorage();
  delete poses[letter];
  savePosesToStorage(poses);
}

// Score management
const SCORE_KEY = 'sign-language-score';

export function saveScore(score: number): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SCORE_KEY, String(score));
  }
}

export function loadScore(): number {
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem(SCORE_KEY);
    if (data) return parseInt(data, 10) || 0;
  }
  return 0;
}

// Progress management
const PROGRESS_KEY = 'sign-language-progress';

export interface LevelProgress {
  levelId: number;
  completed: boolean;
  completedWords: string[];
  bestScore: number;
}

export function saveProgress(progress: LevelProgress[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }
}

export function loadProgress(): LevelProgress[] {
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem(PROGRESS_KEY);
    if (data) {
      try {
        return JSON.parse(data);
      } catch {
        return [];
      }
    }
  }
  return [];
}
