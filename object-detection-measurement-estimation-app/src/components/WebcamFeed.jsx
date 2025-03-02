// src/components/WebcamFeed.jsx
import React, { useRef, useEffect } from 'react';
import Webcam from 'react-webcam';

const WebcamFeed = ({ onDetect, onCanvasClick, predictions, selectedObject }) => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);

  const drawPredictions = (ctx, preds, selected) => {
    const video = webcamRef.current?.video;
    if (!video) return;

    const videoWidth = video.videoWidth; // Actual video resolution (e.g., 320)
    const videoHeight = video.videoHeight; // Actual video resolution (e.g., 240)
    const canvasWidth = canvasRef.current.width; // Displayed canvas width
    const canvasHeight = canvasRef.current.height; // Displayed canvas height

    // Calculate scaling factors
    const scaleX = canvasWidth / videoWidth;
    const scaleY = canvasHeight / videoHeight;

    console.log('Drawing predictions:', preds, 'Scale:', scaleX, scaleY);

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    preds.forEach(prediction => {
      const [x, y, width, height] = prediction.bbox;

      // Scale coordinates to match canvas size
      const scaledX = x * scaleX;
      const scaledY = y * scaleY;
      const scaledWidth = width * scaleX;
      const scaledHeight = height * scaleY;

      ctx.strokeStyle = prediction === selected ? 'green' : 'red';
      ctx.lineWidth = prediction === selected ? 4 : 2;
      ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(
        `${prediction.class} (${Math.round(prediction.score * 100)}%)`,
        scaledX,
        scaledY > 10 ? scaledY - 5 : 10
      );
    });
  };

  useEffect(() => {
    const video = webcamRef.current?.video;
    if (video && onDetect) {
      if (video.videoWidth > 0) {
        onDetect(video);
      } else {
        video.addEventListener('loadedmetadata', () => onDetect(video), { once: true });
      }
    }
  }, [onDetect]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && predictions && predictions.length > 0) {
      drawPredictions(ctx, predictions, selectedObject);
    }
  }, [predictions, selectedObject]);

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: window.innerWidth}}>
      <Webcam
        ref={webcamRef}
        style={{ width: '100%', height: 'auto' }}
        videoConstraints={{ width: window.innerWidth, height: window.innerHeight }}
      />
      <canvas
        ref={canvasRef}
        onClick={onCanvasClick}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
        width={320}
        height={240}
      />
    </div>
  );
};

export default WebcamFeed;