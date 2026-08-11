import * as faceapi from 'face-api.js';
import { debugError } from '@/lib/debugLogger';

const MODEL_URL = '/models';
const MIN_BRIGHTNESS = 40;
const MAX_BRIGHTNESS = 235;

// Face detection downloads a model and then runs inference on the device.
// Both can stall on a slow phone or a flaky connection, so every call is
// bounded — a capture must never wait on this indefinitely.
const FACE_DETECTION_TIMEOUT_MS = 5000;

let modelsLoadedPromise: Promise<void> | null = null;

function loadModels(): Promise<void> {
  if (!modelsLoadedPromise) {
    modelsLoadedPromise = faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL).catch((err) => {
      // Allow retrying on a later call instead of caching a rejected promise forever.
      modelsLoadedPromise = null;
      throw err;
    });
  }

  return modelsLoadedPromise;
}

/**
 * Starts downloading the face detection model without blocking the caller.
 * Call this when the camera opens so the model is usually ready by the time
 * the user takes their photo. Failures are ignored here — analyzeCapturedPhoto
 * retries and degrades gracefully.
 */
export function prewarmPhotoQualityModels(): void {
  loadModels().catch(() => {
    // Intentionally ignored; the capture path handles unavailable models.
  });
}

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

/**
 * Resolves to `null` if the wrapped promise hasn't settled in time. The
 * underlying work isn't cancellable, but the caller stops waiting on it.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function detectFaceCount(canvas: HTMLCanvasElement): Promise<number | null> {
  const detection = (async () => {
    await loadModels();

    const detections = await faceapi.detectAllFaces(
      canvas,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }),
    );

    return detections.length;
  })();

  return withTimeout(detection, FACE_DETECTION_TIMEOUT_MS);
}

export interface PhotoQualityResult {
  ok: boolean;
  /** `null` when face detection was unavailable or timed out. */
  faceCount: number | null;
  brightness: number | null;
  warning: string | null;
}

/**
 * Runs a best-effort, client-side quality check on a captured KYC photo:
 * face presence/count via face-api.js and a basic brightness check.
 * This never rejects and never blocks indefinitely — it is a UX nicety to
 * reduce avoidable admin rejections, not a security gate. When face detection
 * is unavailable the brightness result is still returned and `faceCount` is
 * `null`. Admin review remains the source of truth.
 */
export async function analyzeCapturedPhoto(
  canvas: HTMLCanvasElement,
  mode: 'selfie' | 'id',
): Promise<PhotoQualityResult> {
  // Brightness is a synchronous canvas read, so it still produces a result
  // when face detection can't run.
  const brightness = computeAverageBrightness(canvas);

  let faceCount: number | null = null;

  try {
    faceCount = await detectFaceCount(canvas);
  } catch (err) {
    debugError('Face detection unavailable for photo quality check:', err);
  }

  let warning: string | null = null;

  if (brightness !== null && brightness < MIN_BRIGHTNESS) {
    warning = 'This photo looks too dark. Try retaking it somewhere brighter.';
  } else if (brightness !== null && brightness > MAX_BRIGHTNESS) {
    warning = 'This photo looks overexposed. Try reducing glare or bright light behind you.';
  } else if (faceCount === 0) {
    warning =
      mode === 'selfie'
        ? "We couldn't detect a face. Center your face in the frame and retake the photo."
        : "We couldn't detect a face on the ID. Make sure the ID photo is clearly visible and retake.";
  } else if (mode === 'selfie' && faceCount !== null && faceCount > 1) {
    warning = 'We detected more than one face. Make sure only you are in the frame, then retake.';
  }

  return {
    ok: warning === null,
    faceCount,
    brightness,
    warning,
  };
}
