import * as tf from '@tensorflow/tfjs';

let loadedModel;

// YOLOv8 preprocessing
function preprocessImage(imageData, modelWidth = 640, modelHeight = 640) {
  const tensor = tf.browser.fromPixels(imageData);
  const resized = tf.image.resizeBilinear(tensor, [modelWidth, modelHeight]);
  const normalized = tf.div(resized, 255.0);
  const batched = tf.expandDims(normalized, 0);
  tensor.dispose();
  resized.dispose();
  return batched;
}

// YOLOv8 postprocessing
function processPredictions(prediction, originalWidth, originalHeight, modelWidth = 640, modelHeight = 640) {
  const [batchOutput] = prediction;
  const [boxes, scores, classes] = tf.split(batchOutput, [4, 1, -1], -1);
  
  const boxesData = boxes.dataSync();
  const scoresData = scores.dataSync();
  const classesData = classes.dataSync();
  
  const detections = [];
  const numBoxes = boxesData.length / 4;
  
  for (let i = 0; i < numBoxes; i++) {
    const score = scoresData[i];
    if (score > 0.5) { // Confidence threshold
      const bbox = [
        boxesData[i * 4],     // x
        boxesData[i * 4 + 1], // y
        boxesData[i * 4 + 2], // width
        boxesData[i * 4 + 3]  // height
      ];

      // Convert normalized coordinates to pixel coordinates
      const x = bbox[0] * originalWidth;
      const y = bbox[1] * originalHeight;
      const width = bbox[2] * originalWidth;
      const height = bbox[3] * originalHeight;

      detections.push({
        bbox: [x, y, width, height],
        class: classesData[i].toString(),
        score: score
      });
    }
  }

  return detections;
}

export async function detectObjects(video) {
  if (!loadedModel) {
    loadedModel = await tf.loadGraphModel(
      `${window.location.origin}/yolov8n_web_model/model.json`
    );
    // Warmup the model
    const dummyInput = tf.zeros([1, 640, 640, 3]);
    await loadedModel.executeAsync(dummyInput);
    dummyInput.dispose();
  }

  return tf.tidy(() => {
    // Preprocess
    const input = preprocessImage(video);
    
    // Run inference
    const prediction = loadedModel.predict(input);
    
    // Postprocess
    const detections = processPredictions(
      prediction,
      video.videoWidth,
      video.videoHeight
    );

    return detections;
  });
}