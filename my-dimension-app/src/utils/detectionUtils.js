import { FilesetResolver, ObjectDetector } from "@mediapipe/tasks-vision";

let detector = null;

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
    if (!videoElement || videoElement.readyState !== 4) {
      console.log('Video not ready for detection');
      return [];
    }

    // Create a temporary canvas to extract the current video frame
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoElement.videoWidth;
    tempCanvas.height = videoElement.videoHeight;
    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0);

    const detector = await initializeDetector();
    // Detect on the current frame
    const detections = await detector.detect(tempCanvas);
    
    return detections.detections.map(detection => ({
      class: detection.categories[0].categoryName,
      score: detection.categories[0].score,
      bbox: [
        detection.boundingBox.originX,
        detection.boundingBox.originY,
        detection.boundingBox.width,
        detection.boundingBox.height
      ]
    }));
  } catch (error) {
    console.error("Detection error:", error);
    return [];
  }
}
