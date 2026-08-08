import { HandLandmark, SavedPose, MovementType } from './types';

// ============================================================
// 21-COORDINATE POSE RECOGNITION SYSTEM
// Compares full hand landmark positions (21 points × 3 coords = 63 values)
// Normalized for position/scale invariance. Multiple samples per letter.
// ============================================================

/**
 * Per-landmark importance weights for comparison.
 * Fingertips are most important (2.5x), intermediate joints medium, wrist/base lowest.
 */
const LANDMARK_WEIGHTS: number[] = [
  1,   // 0: wrist
  1.2, // 1: thumb CMC
  1.2, // 2: thumb MCP
  1.5, // 3: thumb IP
  2.0, // 4: thumb tip
  1.2, // 5: index MCP
  1.5, // 6: index PIP
  1.5, // 7: index DIP
  2.5, // 8: index tip
  1.0, // 9: middle MCP (anchor for scaling)
  1.5, // 10: middle PIP
  1.5, // 11: middle DIP
  2.5, // 12: middle tip
  1.2, // 13: ring MCP
  1.5, // 14: ring PIP
  1.5, // 15: ring DIP
  2.5, // 16: ring tip
  1.2, // 17: pinky MCP
  1.5, // 18: pinky PIP
  1.5, // 19: pinky DIP
  2.5, // 20: pinky tip
];

/**
 * Normalize 21 hand landmarks to be position and scale invariant.
 * Centers on wrist (point 0), scales by distance wrist→middle MCP (point 9).
 * Returns flat array of 63 numbers (21 landmarks × 3 coordinates).
 */
export function normalizeLandmarks(landmarks: HandLandmark[]): number[] {
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];

  const scale = Math.sqrt(
    (middleMcp.x - wrist.x) ** 2 +
    (middleMcp.y - wrist.y) ** 2 +
    (middleMcp.z - wrist.z) ** 2
  );
  const safeScale = Math.max(scale, 0.001);

  return landmarks.flatMap((lm) => [
    (lm.x - wrist.x) / safeScale,
    (lm.y - wrist.y) / safeScale,
    (lm.z - wrist.z) / safeScale,
  ]);
}

/**
 * Compare two normalized pose arrays using weighted Euclidean distance.
 * Returns similarity score from 0 (no match) to 1 (perfect match).
 */
export function comparePoses(a: number[], b: number[]): number {
  let totalWeightedDist = 0;
  let totalWeight = 0;

  for (let i = 0; i < a.length; i += 3) {
    const pointIdx = Math.floor(i / 3);
    const w = LANDMARK_WEIGHTS[pointIdx] || 1;
    const dx = a[i] - b[i];
    const dy = a[i + 1] - b[i + 1];
    const dz = a[i + 2] - b[i + 2];
    totalWeightedDist += Math.sqrt(dx * dx + dy * dy + dz * dz) * w;
    totalWeight += w;
  }

  const avgDist = totalWeightedDist / totalWeight;
  // avgDist ≈ 0 → perfect match (1.0)
  // avgDist ≈ 0.4 → no match (0.0)
  return Math.max(0, Math.min(1, 1 - avgDist * 2.5));
}

/**
 * Recognize a static gesture by comparing current 21-point landmarks
 * against ALL saved samples for each letter. Returns the best match with confidence.
 * Confidence is a percentage (0-100).
 */
export function recognizeGesture(
  currentLandmarks: HandLandmark[],
  savedPoses: Record<string, SavedPose>
): { letter: string; confidence: number } | null {
  const current = normalizeLandmarks(currentLandmarks);
  let bestMatch: { letter: string; confidence: number } | null = null;

  for (const [letter, pose] of Object.entries(savedPoses)) {
    if (pose.isMovement || !pose.samples || pose.samples.length === 0) continue;

    // Find best similarity across all samples for this letter
    let bestSim = 0;
    for (const sample of pose.samples) {
      const norm = normalizeLandmarks(sample);
      const sim = comparePoses(current, norm);
      if (sim > bestSim) bestSim = sim;
    }

    if (!bestMatch || bestSim > bestMatch.confidence) {
      bestMatch = { letter, confidence: bestSim };
    }
  }

  // Require minimum 45% confidence to count as a match
  if (bestMatch && bestMatch.confidence >= 0.45) {
    return bestMatch;
  }
  return null;
}

/**
 * Get the confidence (0-1) for a specific letter given current landmarks.
 * Useful for showing "how close" the user is to the target letter.
 */
export function getLetterConfidence(
  currentLandmarks: HandLandmark[],
  letter: string,
  savedPoses: Record<string, SavedPose>
): number {
  const pose = savedPoses[letter];
  if (!pose || pose.isMovement || !pose.samples || pose.samples.length === 0) return 0;

  const current = normalizeLandmarks(currentLandmarks);
  let bestSim = 0;
  for (const sample of pose.samples) {
    const norm = normalizeLandmarks(sample);
    const sim = comparePoses(current, norm);
    if (sim > bestSim) bestSim = sim;
  }
  return bestSim;
}

/**
 * Get the confidence (0-1) for a movement letter given recent frame history.
 */
export function getMovementLetterConfidence(
  currentFrames: HandLandmark[][],
  letter: string,
  savedPoses: Record<string, SavedPose>
): number {
  const pose = savedPoses[letter];
  if (!pose || !pose.isMovement || !pose.movementSamples?.length) return 0;
  if (currentFrames.length < 8) return 0;

  // Trim still frames from start/end so only actual movement is compared
  const trimmed = trimStillFrames(currentFrames);
  if (trimmed.length < 8) return 0;

  const currentTraj = extractTrajectory(trimmed);
  let bestSim = 0;

  for (const savedRecording of pose.movementSamples) {
    const savedTraj = extractTrajectory(savedRecording);
    const sim = compareTrajectories(currentTraj, savedTraj);
    if (sim > bestSim) bestSim = sim;
  }

  return bestSim;
}

/**
 * Trim leading/trailing frames where the index fingertip isn't moving.
 * This prevents still frames from diluting the trajectory comparison.
 */
function trimStillFrames(frames: HandLandmark[][]): HandLandmark[][] {
  if (frames.length < 3) return frames;

  const threshold = 0.002;
  let start = 0;
  let end = frames.length - 1;

  // Find first frame with movement
  for (let i = 1; i < frames.length; i++) {
    const dx = frames[i][8].x - frames[i - 1][8].x;
    const dy = frames[i][8].y - frames[i - 1][8].y;
    if (Math.sqrt(dx * dx + dy * dy) > threshold) {
      start = Math.max(0, i - 1);
      break;
    }
    if (i === frames.length - 1) return frames.slice(-8); // all still, return last frames
  }

  // Find last frame with movement
  for (let i = frames.length - 2; i >= 0; i--) {
    const dx = frames[i + 1][8].x - frames[i][8].x;
    const dy = frames[i + 1][8].y - frames[i][8].y;
    if (Math.sqrt(dx * dx + dy * dy) > threshold) {
      end = Math.min(frames.length - 1, i + 1);
      break;
    }
  }

  if (end <= start) return frames;
  return frames.slice(start, end + 1);
}

// ============================================================
// MOVEMENT RECOGNITION (Trajectory-based, 21 coords per frame)
// ============================================================

/**
 * Extract index fingertip (point 8) trajectory from a sequence of frames.
 */
function extractTrajectory(frames: HandLandmark[][]): { x: number; y: number }[] {
  return frames.map((f) => ({ x: f[8].x, y: f[8].y }));
}

/**
 * Normalize trajectory to a 0-1 bounding box for scale/position invariance.
 * Uses uniform scaling (max of rx, ry) to preserve the shape's aspect ratio.
 */
function normalizeTrajectory(
  points: { x: number; y: number }[]
): { x: number; y: number }[] {
  if (points.length < 2) return points;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const rx = maxX - minX || 1;
  const ry = maxY - minY || 1;
  const scale = Math.max(rx, ry);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return points.map((p) => ({ x: (p.x - cx) / scale, y: (p.y - cy) / scale }));
}

/**
 * Resample a trajectory to a fixed number of points via linear interpolation.
 */
function resampleTrajectory(
  points: { x: number; y: number }[],
  n: number
): { x: number; y: number }[] {
  if (points.length === 0) return [];
  if (points.length === 1) return Array(n).fill(points[0]);
  const result: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (points.length - 1);
    const idx = Math.min(Math.floor(t), points.length - 2);
    const frac = t - idx;
    result.push({
      x: points[idx].x + (points[idx + 1].x - points[idx].x) * frac,
      y: points[idx].y + (points[idx + 1].y - points[idx].y) * frac,
    });
  }
  return result;
}

/**
 * Compare two trajectories using sub-sequence DTW-like sliding window.
 * Finds the best alignment between the live and saved trajectories
 * for maximum similarity, even at different speeds.
 */
function compareTrajectories(
  a: { x: number; y: number }[],
  b: { x: number; y: number }[]
): number {
  if (a.length < 5 || b.length < 5) return 0;
  const ra = normalizeTrajectory(a);
  const rb = normalizeTrajectory(b);
  const n = Math.max(ra.length, rb.length, 20);
  const sa = resampleTrajectory(ra, n);
  const sb = resampleTrajectory(rb, n);

  // Sliding window: try all possible offsets and keep the best match
  const windowSize = Math.floor(n * 0.6);
  let bestDist = Infinity;

  for (let offset = 0; offset <= n - windowSize; offset++) {
    let dist = 0;
    for (let i = 0; i < windowSize; i++) {
      const ai = Math.min(n - 1, offset + Math.floor((i / (windowSize - 1)) * (n - offset - 1)));
      const bi = Math.min(n - 1, Math.floor((i / (windowSize - 1)) * (n - 1)));
      const dx = sa[ai].x - sb[bi].x;
      const dy = sa[ai].y - sb[bi].y;
      dist += Math.sqrt(dx * dx + dy * dy);
    }
    if (dist < bestDist) bestDist = dist;
  }

  const avg = bestDist / windowSize;
  return Math.max(0, Math.min(1, 1 - avg * 1.8));
}

/**
 * Recognize a movement gesture by comparing the current frame sequence
 * trajectory against all saved movement samples.
 */
export function recognizeMovement(
  currentFrames: HandLandmark[][],
  savedPoses: Record<string, SavedPose>
): { letter: string; confidence: number } | null {
  if (currentFrames.length < 8) return null;

  let bestMatch: { letter: string; confidence: number } | null = null;

  for (const [letter, pose] of Object.entries(savedPoses)) {
    if (!pose.isMovement || !pose.movementSamples?.length) continue;

    const currentTraj = extractTrajectory(currentFrames);
    let bestSim = 0;

    for (const savedRecording of pose.movementSamples) {
      const savedTraj = extractTrajectory(savedRecording);
      const sim = compareTrajectories(currentTraj, savedTraj);
      if (sim > bestSim) bestSim = sim;
    }

    if (!bestMatch || bestSim > bestMatch.confidence) {
      bestMatch = { letter, confidence: bestSim };
    }
  }

  if (bestMatch && bestMatch.confidence >= 0.4) {
    return bestMatch;
  }
  return null;
}

// ============================================================
// LEGACY: Feature extraction (kept for CameraView movement TYPE detection)
// ============================================================

export interface FeatureVector {
  thumb: number;
  index: number;
  middle: number;
  ring: number;
  pinky: number;
  thumbAngle: number;
  indexAngle: number;
  wristHeight: number;
}

export function extractFeatures(landmarks: HandLandmark[]): FeatureVector {
  const TIP = [4, 8, 12, 16, 20];
  const PIP = [3, 6, 10, 14, 18];
  const MCP = [2, 5, 9, 13, 17];
  const WRIST = 0;

  const fingerExtended: number[] = [];

  for (let i = 0; i < 5; i++) {
    const tip = landmarks[TIP[i]];
    const pip = landmarks[PIP[i]];
    const mcp = landmarks[MCP[i]];

    if (i === 0) {
      const indexMcp = landmarks[5];
      const tipDist = Math.sqrt(
        (tip.x - indexMcp.x) ** 2 + (tip.y - indexMcp.y) ** 2
      );
      const mcpDist = Math.sqrt(
        (mcp.x - indexMcp.x) ** 2 + (mcp.y - indexMcp.y) ** 2
      );
      fingerExtended.push(tipDist > mcpDist * 1.2 ? 1 : 0);
    } else {
      fingerExtended.push(tip.y < pip.y ? 1 : 0);
    }
  }

  const wrist = landmarks[WRIST];
  const middleMcp = landmarks[9];
  const palmCenter = {
    x: (wrist.x + middleMcp.x) / 2,
    y: (wrist.y + middleMcp.y) / 2,
  };
  const thumbTip = landmarks[4];
  const thumbAngle = Math.atan2(
    thumbTip.y - palmCenter.y,
    thumbTip.x - palmCenter.x
  );

  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const indexAngle = Math.atan2(
    middleTip.y - indexTip.y,
    middleTip.x - indexTip.x
  );

  return {
    thumb: fingerExtended[0],
    index: fingerExtended[1],
    middle: fingerExtended[2],
    ring: fingerExtended[3],
    pinky: fingerExtended[4],
    thumbAngle,
    indexAngle,
    wristHeight: wrist.y,
  };
}

export function detectMovement(frames: FeatureVector[]): MovementType {
  if (frames.length < 5) return 'none';

  const positions = frames.map((f) => ({ x: f.thumbAngle, y: f.wristHeight }));

  let totalDx = 0;
  let totalDy = 0;
  for (let i = 1; i < positions.length; i++) {
    totalDx += positions[i].x - positions[i - 1].x;
    totalDy += positions[i].y - positions[i - 1].y;
  }

  const avgDx = totalDx / (positions.length - 1);
  const avgDy = totalDy / (positions.length - 1);

  let directionChanges = 0;
  for (let i = 2; i < positions.length; i++) {
    const prevDx = positions[i - 1].x - positions[i - 2].x;
    const currDx = positions[i].x - positions[i - 1].x;
    if (prevDx * currDx < 0) directionChanges++;
  }

  if (directionChanges > positions.length / 3) return 'zigzag';
  if (Math.abs(avgDx) > Math.abs(avgDy) * 2) return 'horizontal';
  if (Math.abs(avgDy) > Math.abs(avgDx) * 2) return 'vertical';

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

// ============================================================
// STORAGE (with migration from old format)
// ============================================================

const STORAGE_KEY = 'sign-language-poses';

/**
 * Migrate old pose format (features + single landmarks) to new format (samples array).
 */
function migratePose(raw: any): SavedPose {
  // Already new format: has samples OR has movementSamples
  if (
    (raw.samples && Array.isArray(raw.samples) && raw.samples.length > 0) ||
    (raw.movementSamples && Array.isArray(raw.movementSamples) && raw.movementSamples.length > 0)
  ) {
    return raw as SavedPose;
  }

  const pose: SavedPose = {
    letter: raw.letter || '?',
    samples: [],
    isMovement: raw.isMovement || false,
    movementType: raw.movementType,
    movementSamples: [],
    createdAt: raw.createdAt || Date.now(),
  };

  // Old format: single landmarks array
  if (raw.landmarks && Array.isArray(raw.landmarks) && raw.landmarks.length === 21) {
    pose.samples = [raw.landmarks];
  }

  return pose;
}

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
        const parsed: Record<string, any> = JSON.parse(data);
        const migrated: Record<string, SavedPose> = {};
        for (const [key, raw] of Object.entries(parsed)) {
          migrated[key] = migratePose(raw);
        }
        // Save migrated data back
        savePosesToStorage(migrated);
        return migrated;
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

export function deleteAllPosesFromStorage(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
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
