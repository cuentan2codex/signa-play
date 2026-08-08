---
Task ID: 6
Agent: main
Task: Fix client-side crash and deploy to GitHub Pages

Work Log:
- Analyzed error screenshot: generic Next.js "Application error: a client-side exception has occurred"
- Identified 3 critical bugs causing the crash:
  1. CameraView.tsx: `useCallback` used but not imported → ReferenceError at runtime
  2. CameraView.tsx: `detectMovement` used but not imported from gestureEngine → ReferenceError
  3. TrainingMode.tsx: `useCallback` used but not imported → ReferenceError
  4. TrainingMode.tsx: `MovementType` type used but not imported → potential runtime issue
  5. page.tsx: No mounted guard → hydration mismatch between server (default values) and client (localStorage values)
- Fixed all imports in CameraView.tsx and TrainingMode.tsx
- Added `if (!mounted) return <LoadingSkeleton />` guard in page.tsx
- Removed unsafe `loadProgress()` call from menu button onClick during render
- Built successfully with `next build` (no errors)
- Pushed to GitHub (commit 360ae17)
- GitHub Actions Run #6 completed successfully
- Site returns HTTP 200 at https://cuentan2codex.github.io/signa-play/

Stage Summary:
- Root cause was missing imports (`useCallback`, `detectMovement`, `MovementType`) causing ReferenceError at module load time
- Secondary issue was hydration mismatch from no mounted guard
- All fixes deployed and verified
