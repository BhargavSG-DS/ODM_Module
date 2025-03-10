export function calculateDimensions(bbox, distance, imageWidth, imageHeight, fovDegrees = 60) {
  // Convert FOV from degrees to radians
  const fovRadians = (fovDegrees * Math.PI) / 180;
  
  // Calculate the real-world dimensions using similar triangles
  const viewWidth = 2 * distance * Math.tan(fovRadians / 2);
  const viewHeight = viewWidth * (imageHeight / imageWidth);
  
  // Convert bbox dimensions to real-world measurements
  const realWidth = (bbox.width / imageWidth) * viewWidth;
  const realHeight = (bbox.height / imageHeight) * viewHeight;
  const realDepth = estimateDepth(realWidth, realHeight);

  return {
    width: Math.round(realWidth),
    height: Math.round(realHeight),
    depth: Math.round(realDepth),
    confidence: calculateConfidence(bbox, distance)
  };
}

function estimateDepth(width, height) {
  const avgDimension = (width + height) / 2;
  
  // Most objects have a depth that's proportional to their other dimensions
  // Using a general approximation factor of 0.7
  return avgDimension * 0.7;
}

function calculateConfidence(bbox, distance) {
  // Confidence calculation based on multiple factors
  let confidence = 1.0;
  
  // Distance factor - objects too close or too far are less reliable
  const distanceFactor = Math.min(1.0, Math.max(0, 
    1 - Math.abs(distance - 100) / 200));  // Optimal distance around 100cm
  
  // Size factor - very small or very large bboxes are less reliable
  const sizeFactor = Math.min(1.0, (bbox.width * bbox.height) / (100 * 100));
  
  // Aspect ratio factor - extreme aspect ratios might be less reliable
  const aspectRatio = bbox.width / bbox.height;
  const aspectFactor = Math.min(1.0, Math.max(0,
    1 - Math.abs(aspectRatio - 1) / 2));
  
  confidence *= distanceFactor * sizeFactor * aspectFactor;
  
  return Math.round(confidence * 100);
}
