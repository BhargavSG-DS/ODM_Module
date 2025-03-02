// src/hooks/useObjectDetection.js
import { useState, useEffect, useRef } from 'react';

const useObjectDetection = (videoElement) => {
  const [predictions, setPredictions] = useState([]);
  const [selectedObject, setSelectedObject] = useState(null);
  const workerRef = useRef(null);
  const detectionInterval = useRef(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../lib/workers/detectionWorker.js', import.meta.url));
    workerRef.current.onmessage = (e) => setPredictions(e.data.predictions);

    return () => {
      workerRef.current.terminate();
      clearInterval(detectionInterval.current);
    };
  }, []);

  const detectObjects = (video) => {
    if (video && workerRef.current && video.videoWidth > 0 && video.videoHeight > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      workerRef.current.postMessage({ videoData: imageData });
    }
  };

  useEffect(() => {
    if (videoElement) {
      const startDetection = () => {
        if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
          detectionInterval.current = setInterval(() => detectObjects(videoElement), 200);
        } else {
          videoElement.addEventListener('loadedmetadata', () => {
            detectionInterval.current = setInterval(() => detectObjects(videoElement), 200);
          }, { once: true });
        }
      };
      startDetection();
    }
    return () => clearInterval(detectionInterval.current);
  }, [videoElement]);

  const handleCanvasClick = async (event, canvas) => {
    if (!videoElement || !predictions.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const clickedObject = predictions.find(p => {
      const [px, py, pw, ph] = p.bbox;
      return x >= px && x <= px + pw && y >= py && y <= py + ph;
    });
    setSelectedObject(clickedObject || null);
  };

  return { predictions, selectedObject, detectObjects, handleCanvasClick };
};

export default useObjectDetection;