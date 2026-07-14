import * as faceapi from 'face-api.js';

const MODEL_URL = '/models';
const MIN_BRIGHTNESS = 40;
const MAX_BRIGHTNESS = 235;

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
  faceCount: number;
  brightness: number | null;
  warning: string | null;
}

/**
 * Runs a best-effort, client-side quality check on a captured KYC photo:
 * face presence/count via face-api.js and a basic brightness check.
 * Callers should treat load/inference failures as non-fatal (fail open) —
 * this is a UX nicety to reduce avoidable admin rejections, not a security gate.
 */
export async function analyzeCapturedPhoto(
  canvas: HTMLCanvasElement,
  mode: 'selfie' | 'id',
): Promise<PhotoQualityResult> {
  const brightness = computeAverageBrightness(canvas);

  await loadModels();

  const detections = await faceapi.detectAllFaces(
    canvas,
    new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }),
  );

  const faceCount = detections.length;
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
  } else if (mode === 'selfie' && faceCount > 1) {
    warning = 'We detected more than one face. Make sure only you are in the frame, then retake.';
  }

  return {
    ok: warning === null,
    faceCount,
    brightness,
    warning,
  };
}
