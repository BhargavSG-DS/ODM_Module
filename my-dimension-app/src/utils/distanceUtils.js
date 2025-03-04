// Expanded known width of common objects in centimeters
const KNOWN_OBJECT_WIDTHS = {
  // COCO/YOLOv8 classes
  'person': 45,
  'bicycle': 60,
  'car': 180,
  'motorcycle': 80,
  'airplane': 3000,
  'bus': 250,
  'train': 300,
  'truck': 250,
  'boat': 200,
  'traffic light': 30,
  'fire hydrant': 35,
  'stop sign': 60,
  'parking meter': 30,
  'bench': 120,
  'bird': 15,
  'cat': 30,
  'dog': 40,
  'horse': 160,
  'sheep': 80,
  'cow': 180,
  'elephant': 300,
  'bear': 150,
  'zebra': 150,
  'giraffe': 200,
  'backpack': 35,
  'umbrella': 80,
  'handbag': 25,
  'tie': 8,
  'suitcase': 50,
  'frisbee': 20,
  'skis': 150,
  'snowboard': 140,
  'sports ball': 22,
  'kite': 100,
  'baseball bat': 70,
  'baseball glove': 25,
  'skateboard': 80,
  'surfboard': 180,
  'tennis racket': 70,
  'bottle': 7,
  'wine glass': 8,
  'cup': 8,
  'fork': 15,
  'knife': 20,
  'spoon': 15,
  'bowl': 15,
  'banana': 18,
  'apple': 8,
  'sandwich': 15,
  'orange': 7,
  'broccoli': 12,
  'carrot': 15,
  'hot dog': 15,
  'pizza': 30,
  'donut': 8,
  'cake': 25,
  'chair': 45,
  'couch': 200,
  'potted plant': 30,
  'bed': 200,
  'dining table': 150,
  'toilet': 60,
  'tv': 100,
  'laptop': 35,
  'mouse': 6,
  'remote': 15,
  'keyboard': 36,
  'cell phone': 7,
  'microwave': 50,
  'oven': 60,
  'toaster': 30,
  'sink': 60,
  'refrigerator': 80,
  'book': 15,
  'clock': 25,
  'vase': 20,
  'scissors': 15,
  'teddy bear': 30,
  'hair drier': 20,
  'toothbrush': 15
};

let calibratedFocalLength = null;

export function calibrateFocalLength(knownWidth, knownDistance, pixelWidth) {
  calibratedFocalLength = (pixelWidth * knownDistance) / knownWidth;
  return calibratedFocalLength;
}

export function estimateDistance(objectClass, pixelWidth, imageWidth) {
  console.log('Estimating distance for:', { objectClass, pixelWidth, imageWidth });
  
  const realWidth = KNOWN_OBJECT_WIDTHS[objectClass.toLowerCase()];
  console.log('Known width for object:', realWidth);
  
  if (!realWidth) {
    console.log('No known width for object class:', objectClass);
    return null;
  }

  if (!pixelWidth || pixelWidth <= 0 || !imageWidth || imageWidth <= 0) {
    console.log('Invalid dimensions:', { pixelWidth, imageWidth });
    return null;
  }

  // Estimate focal length based on typical webcam FOV (60 degrees)
  const focalLength = calibratedFocalLength || (imageWidth / 2) / Math.tan(Math.PI / 6);
  console.log('Using focal length:', focalLength);

  // Distance = (Known width * Focal length) / Pixel width
  const distanceCm = (realWidth * focalLength) / pixelWidth;
  console.log('Calculated distance:', distanceCm);

  // Apply sanity checks
  if (distanceCm < 10 || distanceCm > 1000) {
    console.log('Distance out of reasonable range:', distanceCm);
    return null;
  }

  return Math.round(distanceCm);
}

export function getDepthFromSize(originalSize, currentSize, baseDistance) {
  // Using the ratio of sizes to estimate relative depth
  return baseDistance * (originalSize / currentSize);
}
