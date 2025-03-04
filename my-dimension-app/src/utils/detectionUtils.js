import { FilesetResolver, ObjectDetector } from "@mediapipe/tasks-vision";

let detector = null;
let lastDetectionTime = 0;
const DETECTION_INTERVAL = 200; // Limit to 5 detections per second

async function initializeDetector() {
  if (!detector) {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      detector = await ObjectDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float16/1/efficientdet_lite2.tflite",
          delegate: "GPU"
        },
        scoreThreshold: 0.7,
        maxResults: 5,
        runningMode: "IMAGE"  // Changed to IMAGE mode
      });

      console.log('MediaPipe detector initialized successfully');
    } catch (error) {
      console.error('Error initializing MediaPipe detector:', error);
      throw error;
    }
  }
  return detector;
}

export async function detectObjects(videoElement) {
  try {
    const now = Date.now();
    if (now - lastDetectionTime < DETECTION_INTERVAL) {
      return null; // Skip detection if too soon
    }

    if (!videoElement || videoElement.readyState !== 4) {
      return [];
    }

    lastDetectionTime = now;
    const detector = await initializeDetector();

    // Create a temporary canvas with reduced size
    const tempCanvas = document.createElement('canvas');
    const scale = 0.5; // Reduce resolution by half
    tempCanvas.width = videoElement.videoWidth * scale;
    tempCanvas.height = videoElement.videoHeight * scale;
    const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);

    const detections = await detector.detect(tempCanvas);
    
    // Scale back the detection coordinates
    return detections.detections.map(detection => ({
      class: detection.categories[0].categoryName,
      score: detection.categories[0].score,
      bbox: [
        detection.boundingBox.originX / scale,
        detection.boundingBox.originY / scale,
        detection.boundingBox.width / scale,
        detection.boundingBox.height / scale
      ]
    }));
  } catch (error) {
    console.error("Detection error:", error);
    return [];
  }
}
