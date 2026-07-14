/**
 * Lazy wrapper around nsfwjs (TensorFlow.js) so the heavy model code is only
 * downloaded when an admin explicitly starts a scan from the moderation queue.
 */

export type NsfwClassScores = Record<string, number>;

export type NsfwScanResult = {
  nsfwScore: number;
  topClass: string;
  classScores: NsfwClassScores;
  model: string;
};

type NsfwPrediction = { className: string; probability: number };
type NsfwModel = { classify: (input: HTMLImageElement) => Promise<NsfwPrediction[]> };

const MODEL_NAME = 'nsfwjs-mobilenet-v2';

// Classes that count toward the aggregate "NSFW" score.
const NSFW_CLASSES = new Set(['Porn', 'Hentai', 'Sexy']);

let modelPromise: Promise<NsfwModel> | null = null;

async function loadModel(): Promise<NsfwModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const [tf, nsfwjs] = await Promise.all([
        import('@tensorflow/tfjs'),
        import('nsfwjs'),
      ]);

      await tf.ready();

      // nsfwjs v4 bundles the quantized MobileNetV2 model with the package,
      // so no external model host is required.
      return nsfwjs.load() as Promise<NsfwModel>;
    })().catch((error) => {
      modelPromise = null;
      throw error;
    });
  }

  return modelPromise;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load image for scanning (CORS or network error).'));
    image.src = url;
  });
}

export async function scanImageUrl(url: string): Promise<NsfwScanResult> {
  const model = await loadModel();
  const image = await loadImage(url);
  const predictions = await model.classify(image);

  const classScores: NsfwClassScores = {};
  let nsfwScore = 0;
  let topClass = 'Neutral';
  let topProbability = 0;

  for (const prediction of predictions) {
    const probability = Number(prediction.probability.toFixed(4));
    classScores[prediction.className] = probability;

    if (NSFW_CLASSES.has(prediction.className)) {
      nsfwScore += probability;
    }

    if (probability > topProbability) {
      topProbability = probability;
      topClass = prediction.className;
    }
  }

  return {
    nsfwScore: Number(Math.min(nsfwScore, 1).toFixed(4)),
    topClass,
    classScores,
    model: MODEL_NAME,
  };
}

export function nsfwRiskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 0.7) return 'high';
  if (score >= 0.35) return 'medium';
  return 'low';
}
