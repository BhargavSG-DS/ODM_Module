// src/lib/tfjs/modelLoader.js
import { pipeline } from '@xenova/transformers';

export const loadHuggingFaceModel = async (modelName = 'Xenova/detr-resnet-50') => {
  const detector = await pipeline('object-detection', modelName);
  return detector;
};