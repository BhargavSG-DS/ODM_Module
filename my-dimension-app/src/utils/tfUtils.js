import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as bodyPix from '@tensorflow-models/body-pix';

let cocoModel, bodyPixModel;

export async function detectObjects(video) {
  await tf.ready();

  if (!cocoModel) {
    cocoModel = await cocoSsd.load();
  }
  if (!bodyPixModel) {
    bodyPixModel = await bodyPix.load();
  }

  // Detect objects with COCO-SSD
  const predictions = await cocoModel.detect(video);

  // Enhance with segmentation if a glass-like object is detected
  const enhancedPredictions = await Promise.all(predictions.map(async (pred) => {
    if (pred.class === 'cup' || pred.class === 'bottle') { // Closest match to "glass"
      const segmentation = await bodyPixModel.segmentPersonParts(video, {
        flipHorizontal: false,
        internalResolution: 'medium',
        segmentationThreshold: 0.7,
      });
      // Simplified: Use bounding box for now, segmentation data available for future use
      return { ...pred, segmentation };
    }
    return pred;
  }));

  return enhancedPredictions.map(pred => ({
    ...pred,
    bbox: [pred.bbox[0], pred.bbox[1], pred.bbox[2], pred.bbox[3]], // Keep original pixel values
  }));
}