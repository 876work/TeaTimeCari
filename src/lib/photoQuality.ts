const MIN_BRIGHTNESS = 40;
const MAX_BRIGHTNESS = 235;

function computeAverageBrightness(canvas: HTMLCanvasElement): number | null {
  const context = canvas.getContext('2d');

  if (!context) return null;

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let sum = 0;
  let sampleCount = 0;

  // Sample every 4th pixel for speed; brightness doesn't need every pixel.
  for (let i = 0; i < data.length; i += 16) {
    sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
    sampleCount += 1;
  }

  return sampleCount > 0 ? sum / sampleCount : null;
}

export interface PhotoQualityResult {
  ok: boolean;
  brightness: number | null;
  warning: string | null;
}

/**
 * Best-effort quality check on a captured KYC photo.
 *
 * Deliberately synchronous and dependency-free: it reads pixels already on the
 * canvas and returns. It cannot download anything, cannot block the main
 * thread for a meaningful amount of time, and cannot leave the capture screen
 * waiting on it.
 *
 * This previously also ran face detection (face-api.js + TensorFlow.js). That
 * check was advisory, but on real phones its model download and inference
 * could stall long enough to strand users on the capture step, so it was
 * removed from the signup path. Admin review remains the source of truth for
 * whether a photo is acceptable.
 */
export function analyzeCapturedPhoto(canvas: HTMLCanvasElement): PhotoQualityResult {
  const brightness = computeAverageBrightness(canvas);
  let warning: string | null = null;

  if (brightness !== null && brightness < MIN_BRIGHTNESS) {
    warning =
      'This photo looks too dark — we may not be able to see you. Move somewhere brighter, ' +
      'check nothing is covering the camera, and retake it.';
  } else if (brightness !== null && brightness > MAX_BRIGHTNESS) {
    warning = 'This photo looks overexposed. Try reducing glare or bright light behind you.';
  }

  return {
    ok: warning === null,
    brightness,
    warning,
  };
}
