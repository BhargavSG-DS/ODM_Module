// src/lib/workers/detectionWorker.js
self.importScripts(
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js',
    'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd'
  );
  
  // Set WebGL backend before any TensorFlow operations
  self.tf.setBackend('webgl').then(() => {
    console.log('WebGL backend initialized');
  }).catch(err => {
    console.error('Failed to set WebGL backend:', err);
    // Fallback to CPU if WebGL fails
    self.tf.setBackend('cpu');
  });
  
  let model;
  
  self.onmessage = async (e) => {
    const { videoData } = e.data;
  
    if (!model) {
      model = await cocoSsd.load();
    }
  
    const predictions = await model.detect(videoData);
    self.postMessage({ predictions });
  };