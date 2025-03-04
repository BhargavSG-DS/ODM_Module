import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { detectObjects } from '../utils/detectionUtils';
import { estimateDistance, getDepthFromSize } from '../utils/distanceUtils';
import { calculateDimensions } from '../utils/dimensionUtils';

function ARVideoFeed({ setDetectedObjects, selectedObject, onCanvasClick, onReset, onSelectObject }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [is3DMode, setIs3DMode] = useState(false);
  const containerRef = useRef(null);
  const resizeTimeoutRef = useRef(null);
  const [initialObjectSize, setInitialObjectSize] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modified getCameras function with better error handling
  const getCameras = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true }); // Request permission first
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      console.log('Available cameras:', videoDevices);
      
      setCameras(videoDevices);
      if (videoDevices.length > 0 && !selectedCamera) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
      setCameraError(null);
    } catch (error) {
      console.error('Camera access error:', error);
      setCameraError('Camera access denied or not available');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResize = useCallback(() => {
    if (!containerRef.current || !videoRef.current || !canvasRef.current) return;

    // Clear existing timeout
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }

    // Debounce resize operation
    resizeTimeoutRef.current = setTimeout(() => {
      const container = containerRef.current;
      const containerWidth = container.clientWidth;
      const videoAspectRatio = videoRef.current.videoWidth / videoRef.current.videoHeight;
      const containerHeight = containerWidth / videoAspectRatio;

      // Update canvas size
      canvasRef.current.style.width = `${containerWidth}px`;
      canvasRef.current.style.height = `${containerHeight}px`;
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;

      // Update renderer if in 3D mode
      if (rendererRef.current && cameraRef.current) {
        rendererRef.current.setSize(containerWidth, containerHeight);
        cameraRef.current.aspect = videoAspectRatio;
        cameraRef.current.updateProjectionMatrix();
      }
    }, 250); // 250ms debounce
  }, []);

  // Modified startVideo function
  const startVideo = async (deviceId = null) => {
    try {
      setIsLoading(true);
      const constraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment'
        }
      };

      console.log('Requesting camera with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log('Stream attached to video element');
        
        // Force video element to update
        videoRef.current.load();
        await videoRef.current.play();
        
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        console.log('Camera settings:', settings);
        
        setDeviceInfo({
          name: track.label,
          width: settings.width,
          height: settings.height,
          frameRate: settings.frameRate,
          aspectRatio: settings.aspectRatio
        });

        // Update canvas size
        if (canvasRef.current) {
          canvasRef.current.width = settings.width;
          canvasRef.current.height = settings.height;
          handleResize();
        }
      }
      setCameraError(null);
    } catch (error) {
      console.error('Camera start error:', error);
      setCameraError(`Failed to start camera: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('ARVideoFeed mounted, selectedObject:', selectedObject);
    getCameras();
    navigator.mediaDevices.addEventListener('devicechange', getCameras);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getCameras);
    };
  }, []);

  // Add effect to handle camera selection
  useEffect(() => {
    if (selectedCamera) {
      // Stop existing stream if any
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
      startVideo(selectedCamera);
    }
  }, [selectedCamera]);

  const start3DView = async () => {
    setIs3DMode(true);
    const canvas = canvasRef.current;
    rendererRef.current = new THREE.WebGLRenderer({ canvas, alpha: true });
    rendererRef.current.setSize(canvas.width, canvas.height);

    sceneRef.current = new THREE.Scene();
    cameraRef.current = new THREE.PerspectiveCamera(70, canvas.width / canvas.height, 0.01, 20);
    
    const light = new THREE.AmbientLight(0xffffff, 1);
    sceneRef.current.add(light);
    cameraRef.current.position.z = 2;
    
    const animate = () => {
      requestAnimationFrame(animate);
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();
  };

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    let animationFrameId;
    const renderLoop = async () => {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

      if (selectedObject) {
        const objects = await detectObjects(videoRef.current);
        console.log('Detected objects:', objects);

        const trackedObject = objects.find(obj =>
          obj.class === selectedObject.class &&
          Math.abs(obj.bbox[0] - selectedObject.bbox[0]) < 50 &&
          Math.abs(obj.bbox[1] - selectedObject.bbox[1]) < 50
        ) || selectedObject;

        console.log('Tracked object:', trackedObject);

        const obj = trackedObject;
        const clampedBbox = {
          x: Math.max(0, Math.min(obj.bbox[0], canvasRef.current.width)),
          y: Math.max(0, Math.min(obj.bbox[1], canvasRef.current.height)),
          width: Math.min(obj.bbox[2], canvasRef.current.width - obj.bbox[0]),
          height: Math.min(obj.bbox[3], canvasRef.current.height - obj.bbox[1]),
        };

        // Calculate distance with better error handling
        let distance = null;
        try {
          distance = estimateDistance(
            obj.class,
            clampedBbox.width,
            canvasRef.current.width
          );
          console.log('Estimated distance:', distance);
        } catch (error) {
          console.error('Distance estimation error:', error);
        }

        // Track object size changes for relative depth
        if (!initialObjectSize && distance) {
          setInitialObjectSize({
            width: clampedBbox.width,
            distance: distance
          });
        }

        // Get relative depth if we have initial size
        const relativeDepth = initialObjectSize
          ? getDepthFromSize(initialObjectSize.width, clampedBbox.width, initialObjectSize.distance)
          : null;

        // Draw bounding box and measurements
        ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.fillRect(clampedBbox.x, clampedBbox.y, clampedBbox.width, clampedBbox.height);

        ctx.strokeStyle = 'green';
        ctx.lineWidth = 2;
        ctx.strokeRect(clampedBbox.x, clampedBbox.y, clampedBbox.width, clampedBbox.height);

        // Draw distance information
        ctx.fillStyle = 'green';
        ctx.font = '16px Arial';
        const distanceText = distance ? `Distance: ${distance} cm` : 'Calculating...';
        ctx.fillText(distanceText, clampedBbox.x, clampedBbox.y - 40);
        
        // Add object class and confidence
        ctx.fillText(`${obj.class} (${Math.round(obj.score * 100)}%)`, 
          clampedBbox.x, clampedBbox.y - 60);

        console.log('Tracked object:', obj.class, 'BBox:', obj.bbox, 'Distance:', distance, 'Relative Depth:', relativeDepth);

        // Calculate dimensions when we have a valid distance
        if (distance) {
          const dimensions = calculateDimensions(
            clampedBbox,
            distance,
            canvasRef.current.width,
            canvasRef.current.height
          );

          // Draw dimensions
          ctx.fillStyle = 'green';
          ctx.font = '16px Arial';
          
          // Draw base measurements
          ctx.fillText(`Width: ${dimensions.width}cm`, clampedBbox.x + 140, clampedBbox.y - 60);
          ctx.fillText(`Height: ${dimensions.height}cm`, clampedBbox.x + 140, clampedBbox.y - 40);
          // ctx.fillText(`Depth: ${dimensions.depth}cm`, clampedBbox.x + 140, clampedBbox.y - 20);
          
          // Draw confidence indicator
          ctx.fillStyle = dimensions.confidence > 80 ? 'green' : 'orange';
          ctx.fillText(`Confidence: ${dimensions.confidence}%`, 
            clampedBbox.x + clampedBbox.width - 140, 
            clampedBbox.y - 20
          );

          // Draw dimension lines
          drawDimensionLines(ctx, clampedBbox, dimensions);
        }
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };
    animationFrameId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      setInitialObjectSize(null);
    };
  }, [selectedObject, initialObjectSize]);

  // Add helper function for drawing dimension lines
  const drawDimensionLines = (ctx, bbox, dimensions) => {
    ctx.save();
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 2;
    
    // Width line
    ctx.beginPath();
    ctx.moveTo(bbox.x, bbox.y + bbox.height);
    ctx.lineTo(bbox.x + bbox.width, bbox.y + bbox.height);
    ctx.stroke();
    
    // Height line
    ctx.beginPath();
    ctx.moveTo(bbox.x, bbox.y);
    ctx.lineTo(bbox.x, bbox.y + bbox.height);
    ctx.stroke();
    
    // Depth indicators (diagonal lines at corners)
    const depthSize = 20;
    ctx.setLineDash([5, 5]);
    
    // Top-right corner
    ctx.beginPath();
    ctx.moveTo(bbox.x + bbox.width, bbox.y);
    ctx.lineTo(bbox.x + bbox.width + depthSize, bbox.y - depthSize);
    ctx.stroke();
    
    // Bottom-right corner
    ctx.beginPath();
    ctx.moveTo(bbox.x + bbox.width, bbox.y + bbox.height);
    ctx.lineTo(bbox.x + bbox.width + depthSize, bbox.y + bbox.height - depthSize);
    ctx.stroke();
    
    ctx.setLineDash([]);
    ctx.restore();
  };

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [handleResize]);

  const handleCanvasClick = async (e) => {
    if (videoRef.current && videoRef.current.paused) {
      videoRef.current.play().catch((err) => console.error('Playback failed:', err));
      return;
    }

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    onCanvasClick(x, y);

    try {
      const objects = await detectObjects(videoRef.current);
      console.log('Detected:', objects);
      setDetectedObjects(objects);

      const clickedObject = objects.find(obj =>
        x >= obj.bbox[0] && x <= obj.bbox[0] + obj.bbox[2] &&
        y >= obj.bbox[1] && y <= obj.bbox[1] + obj.bbox[3]
      );

      if (clickedObject) {
        setDetectedObjects([clickedObject]);
        const ctx = canvasRef.current.getContext('2d');
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 2;
        ctx.strokeRect(clickedObject.bbox[0], clickedObject.bbox[1], clickedObject.bbox[2], clickedObject.bbox[3]);
      } else {
        alert('No object detected at this position. Try clicking a distinct object.');
      }
    } catch (error) {
      console.error('Detection error:', error);
    }
  };

  const buttonStyle = {
    position: 'absolute',
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    border: '3px solid white',
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '12px',
    textAlign: 'center',
    pointerEvents: 'auto',
    zIndex: 10,
  };

  return (
    <div 
      ref={containerRef}
      style={{ 
        position: 'relative',
        width: '100%',
        height: 'auto',
        maxWidth: '100vw',
        margin: '0 auto',
        overflow: 'hidden'
      }}
    >
      {isLoading && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white', background: 'rgba(0,0,0,0.7)', padding: '20px', borderRadius: '10px', zIndex: 20 }}>
          Loading camera...
        </div>
      )}
      
      {cameraError && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'red', background: 'rgba(0,0,0,0.7)', padding: '20px', borderRadius: '10px', zIndex: 20 }}>
          {cameraError}
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ 
          width: '100%',
          height: 'auto',
          display: 'block',
          objectFit: 'contain',
          backgroundColor: '#000'
        }}
        onLoadedMetadata={() => {
          console.log('Video metadata loaded');
          handleResize();
        }}
        onError={(e) => {
          console.error('Video error:', e);
          setCameraError('Video failed to load');
        }}
      />
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          pointerEvents: 'auto',
          zIndex: 1,
        }}
      />
      <button
        onClick={start3DView}
        style={{
          ...buttonStyle,
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '16px',
          display: !is3DMode ? 'flex' : 'none'
        }}
      >
        Start 3D View
      </button>
      <select
        value={selectedCamera || ''}
        onChange={(e) => setSelectedCamera(e.target.value)}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 10,
          padding: '5px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          border: '1px solid white',
          borderRadius: '4px'
        }}
      >
        {cameras.map(camera => (
          <option key={camera.deviceId} value={camera.deviceId}>
            {camera.label || `Camera ${cameras.indexOf(camera) + 1}`}
          </option>
        ))}
      </select>

      {deviceInfo && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 10,
          maxWidth: '90%',  // Prevent overflow on small screens
          wordBreak: 'break-word'  // Handle long device names
        }}>
          {deviceInfo.name} | {deviceInfo.width}x{deviceInfo.height} | 
          {deviceInfo.frameRate}fps | Ratio: {deviceInfo.aspectRatio?.toFixed(2)}
        </div>
      )}
      {selectedObject && (
        <>
          <button
            onClick={onReset}
            style={{
              ...buttonStyle,
              bottom: '20px',
              right: '20px',
            }}
          >
            Reset
          </button>
          <button
            onClick={() => onSelectObject(selectedObject)}
            style={{
              ...buttonStyle,
              bottom: '20px',
              left: '20px',
            }}
          >
            {selectedObject.class}
          </button>
        </>
      )}
    </div>
  );
}

export default ARVideoFeed;