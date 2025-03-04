import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { detectObjects } from '../utils/detectionUtils';
import { estimateDistance, getDepthFromSize } from '../utils/distanceUtils';
import { calculateDimensions } from '../utils/dimensionUtils';
import ObjectMarker from './ObjectMarker';

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
  const [detectedObjects, setDetectedObjectsState] = useState([]);
  const [showMeasurements, setShowMeasurements] = useState(false);
  const webglCanvasRef = useRef(null); // Add new ref for WebGL canvas
  const [videoOrientation, setVideoOrientation] = useState(0);

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

  // Modified handleResize function
  const handleResize = useCallback(() => {
    if (!containerRef.current || !videoRef.current || !canvasRef.current) return;

    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }

    resizeTimeoutRef.current = setTimeout(() => {
      // Set fixed canvas size based on video dimensions
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;

      // Scale the canvas display size while maintaining aspect ratio
      const containerWidth = containerRef.current.clientWidth;
      const scale = containerWidth / canvasRef.current.width;
      canvasRef.current.style.width = `${canvasRef.current.width * scale}px`;
      canvasRef.current.style.height = `${canvasRef.current.height * scale}px`;

      if (rendererRef.current && cameraRef.current) {
        rendererRef.current.setSize(canvasRef.current.width, canvasRef.current.height);
        cameraRef.current.aspect = canvasRef.current.width / canvasRef.current.height;
        cameraRef.current.updateProjectionMatrix();
      }

      // Update WebGL canvas size
      if (webglCanvasRef.current && rendererRef.current) {
        webglCanvasRef.current.width = canvasRef.current.width;
        webglCanvasRef.current.height = canvasRef.current.height;
        rendererRef.current.setSize(
          canvasRef.current.width,
          canvasRef.current.height,
          false
        );
      }
    }, 250);
  }, []);

  // Helper function to convert canvas coordinates to percentages
  const getRelativePosition = (x, y) => ({
    x: (x / canvasRef.current.width) * 100,
    y: (y / canvasRef.current.height) * 100
  });

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

        // Get video orientation from track settings
        if (settings.deviceOrientation) {
          setVideoOrientation(settings.deviceOrientation || 0);
        }

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
    const canvas = webglCanvasRef.current;
    
    try {
      rendererRef.current = new THREE.WebGLRenderer({ 
        canvas,
        alpha: true,
        antialias: true 
      });
      rendererRef.current.setSize(canvasRef.current.width, canvasRef.current.height);
      rendererRef.current.setClearColor(0x000000, 0);

      sceneRef.current = new THREE.Scene();
      cameraRef.current = new THREE.PerspectiveCamera(
        70,
        canvas.width / canvas.height,
        0.01,
        20
      );
      
      const light = new THREE.AmbientLight(0xffffff, 1);
      sceneRef.current.add(light);
      cameraRef.current.position.z = 2;
      
      const animate = () => {
        if (!is3DMode) return; // Stop animation when 3D mode is disabled
        requestAnimationFrame(animate);
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
      };
      animate();
    } catch (error) {
      console.error('WebGL initialization error:', error);
      setIs3DMode(false);
    }
  };

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    let animationFrameId;
    const renderLoop = async () => {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

      if (!selectedObject) {
        const objects = await detectObjects(videoRef.current);
        const highConfidenceObjects = objects.filter(obj => obj.score >= 0.7);
        
        // Draw overlay for detected objects
        highConfidenceObjects.forEach(obj => {
          ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
          ctx.fillRect(
            obj.bbox[0],
            obj.bbox[1],
            obj.bbox[2],
            obj.bbox[3]
          );
        });
        
        setDetectedObjectsState(highConfidenceObjects);
      }

      if (selectedObject && showMeasurements) {
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
  }, [selectedObject, initialObjectSize, showMeasurements]);

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

  const handleObjectSelect = (object) => {
    if (object.score >= 0.6) {
      setSelectedObject(object);
      setShowMeasurements(true);
      setDetectedObjectsState([]); // Clear other markers
      setInitialObjectSize({
        width: object.bbox[2],
        distance: object.distance
      });
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

  // Update video style to handle orientation
  const videoStyle = {
    width: '100%',
    height: 'auto',
    display: 'block',
    objectFit: 'contain',
    backgroundColor: '#000',
    transform: `rotate(${videoOrientation}deg)`,
    transition: 'transform 0.3s ease'
  };

  // Update canvas style to match video orientation
  const canvasStyle = {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'auto',
    zIndex: 1,
    transform: `rotate(${videoOrientation}deg)`,
    transition: 'transform 0.3s ease'
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
        style={videoStyle}
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
        style={canvasStyle}
      />
      {/* Add separate WebGL canvas */}
      <canvas
        ref={webglCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 2,
          display: is3DMode ? 'block' : 'none'
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
        </>
      )}

      {/* Updated object markers */}
      {!selectedObject && detectedObjects.map((obj, index) => {
        const center = getRelativePosition(
          obj.bbox[0] + obj.bbox[2] / 2,
          obj.bbox[1] + obj.bbox[3] / 2
        );
        
        return (
          <ObjectMarker
            key={`${obj.class}-${index}`}
            object={obj}
            onClick={handleObjectSelect}
            onSelect={handleObjectSelect}
            position={center}
            canvasWidth={canvasRef.current?.width}
            canvasHeight={canvasRef.current?.height}
          />
        );
      })}

      {/* Modified control buttons */}
      {selectedObject && showMeasurements && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: '10px',
          borderRadius: '8px',
          color: 'white',
          zIndex: 20
        }}>
          <button
            onClick={() => {
              setShowMeasurements(false);
              setSelectedObject(null);
              setInitialObjectSize(null);
            }}
            style={{
              backgroundColor: '#ff4444',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Stop Measuring
          </button>
        </div>
      )}
    </div>
  );
}

export default ARVideoFeed;