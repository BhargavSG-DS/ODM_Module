import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { detectObjects } from '../utils/tfUtils';

function ARVideoFeed({ arSession, setARSession, setDetectedObjects, selectedObject, onCanvasClick, onReset, onSelectObject }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const referenceSpaceRef = useRef(null);
  const [arSupported, setARSupported] = useState(null); // Track AR support
  const [arError, setARError] = useState(null); // Track AR errors

  useEffect(() => {
    console.log('ARVideoFeed mounted, selectedObject:', selectedObject);
    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((err) => {
            console.error('Video play failed:', err);
            alert('Tap the screen to start the video feed.');
          });
          videoRef.current.addEventListener('loadedmetadata', () => {
            const canvas = canvasRef.current;
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
          });
        }
      } catch (error) {
        console.error('Camera access failed:', error);
        alert('Failed to access camera. Ensure permissions and HTTPS.');
      }
    };
    startVideo();

    // Check AR support on mount
    const checkARSupport = async () => {
      if (!navigator.xr) {
        console.log('WebXR not supported in this browser.');
        setARSupported(false);
        return;
      }
      const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
      console.log('Immersive AR supported:', isSupported);
      setARSupported(isSupported);
    };
    checkARSupport();
  }, []);

  const startAR = async () => {
    if (!navigator.xr || !arSupported) {
      console.log('AR not supported or already checked as unsupported.');
      setARError('AR not supported on this device.');
      return;
    }

    try {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test', 'local-floor'],
        optionalFeatures: ['dom-overlay'],
      });
      console.log('AR session started:', session);
      setARSession(session);
      setARError(null);

      const canvas = canvasRef.current;
      rendererRef.current = new THREE.WebGLRenderer({ canvas, alpha: true });
      rendererRef.current.setSize(canvas.width, canvas.height);

      sceneRef.current = new THREE.Scene();
      cameraRef.current = new THREE.PerspectiveCamera(70, canvas.width / canvas.height, 0.01, 20);

      session.updateRenderState({ baseLayer: new XRWebGLLayer(session, rendererRef.current) });

      referenceSpaceRef.current = await session.requestReferenceSpace('local-floor');
      console.log('Reference space set:', referenceSpaceRef.current);
    } catch (error) {
      console.error('Failed to start AR session:', error);
      setARError('Failed to start AR: ' + error.message);
    }
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
        const trackedObject = objects.find(obj =>
          obj.class === selectedObject.class &&
          Math.abs(obj.bbox[0] - selectedObject.bbox[0]) < 50 &&
          Math.abs(obj.bbox[1] - selectedObject.bbox[1]) < 50
        ) || selectedObject;

        const obj = trackedObject;
        const clampedBbox = {
          x: Math.max(0, Math.min(obj.bbox[0], canvasRef.current.width)),
          y: Math.max(0, Math.min(obj.bbox[1], canvasRef.current.height)),
          width: Math.min(obj.bbox[2], canvasRef.current.width - obj.bbox[0]),
          height: Math.min(obj.bbox[3], canvasRef.current.height - obj.bbox[1]),
        };

        ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.fillRect(clampedBbox.x, clampedBbox.y, clampedBbox.width, clampedBbox.height);

        ctx.strokeStyle = 'green';
        ctx.lineWidth = 2;
        ctx.strokeRect(clampedBbox.x, clampedBbox.y, clampedBbox.width, clampedBbox.height);

        const distanceCm = obj.distanceCm || 100;
        const fovHorizontalDeg = 60;
        const fovVerticalDeg = fovHorizontalDeg * (canvasRef.current.height / canvasRef.current.width);
        const widthRealCm = 2 * distanceCm * Math.tan((fovHorizontalDeg * Math.PI / 180) / 2);
        const pixelToCmRatio = widthRealCm / canvasRef.current.width;
        const widthCm = Math.round(clampedBbox.width * pixelToCmRatio);
        const heightCm = Math.round(clampedBbox.height * pixelToCmRatio);

        ctx.fillStyle = 'green';
        ctx.font = '16px Arial';
        const widthText = `${widthCm} cm`;
        const heightText = `${heightCm} cm`;
        ctx.fillText(widthText, clampedBbox.x + clampedBbox.width / 2 - ctx.measureText(widthText).width / 2, clampedBbox.y - 10);
        ctx.save();
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(heightText, -clampedBbox.y - clampedBbox.height / 2 - 20, clampedBbox.x - 10);
        ctx.restore();

        console.log('Tracked object:', obj.class, 'BBox:', obj.bbox, 'Distance:', distanceCm, 'Cm:', widthCm, heightCm);

        if (arSession && referenceSpaceRef.current) {
          arSession.requestAnimationFrame((time, frame) => {
            console.log('AR frame:', frame);
            const pose = frame.getViewerPose(referenceSpaceRef.current);
            if (pose) {
              console.log('Viewer pose:', pose);
              const hitTestSource = arSession.requestHitTestSource({ space: referenceSpaceRef.current });
              frame.getHitTestResults(hitTestSource).then((hitResults) => {
                console.log('Hit test results:', hitResults);
                if (hitResults.length > 0) {
                  const hitPose = hitResults[0].getPose(referenceSpaceRef.current);
                  const position = hitPose.transform.position;
                  console.log('Hit position:', position.x, position.y, position.z);

                  if (!sceneRef.current.children.length) {
                    const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
                    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                    const cube = new THREE.Mesh(geometry, material);
                    sceneRef.current.add(cube);
                    console.log('Cube added to scene');
                  }

                  const mesh = sceneRef.current.children[0];
                  mesh.position.set(position.x, position.y, position.z);
                  rendererRef.current.render(sceneRef.current, cameraRef.current);
                  console.log('Rendered AR scene');
                } else {
                  console.log('No hit results');
                }
              }).catch(err => console.error('Hit test error:', err));
            } else {
              console.log('No viewer pose');
            }
          });
        }
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };
    animationFrameId = requestAnimationFrame(renderLoop);

    return () => cancelAnimationFrame(animationFrameId);
  }, [arSession, selectedObject]);

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
    <div style={{ position: 'relative', width: '100%', height: 'auto' }}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: '100%', height: 'auto', display: 'block', zIndex: 0 }}
      />
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'auto',
          zIndex: 1,
        }}
      />
      {arSupported === null && <p>Loading AR support check...</p>}
      {arSupported === false && <p>AR not supported on this device.</p>}
      {arSupported && !arSession && !arError && (
        <button
          onClick={startAR}
          style={{
            ...buttonStyle,
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '16px',
          }}
        >
          Start AR
        </button>
      )}
      {arError && <p style={{ color: 'red', zIndex: 10 }}>{arError}</p>}
      <button
        onClick={() => {
          console.log('Reset clicked');
          onReset();
        }}
        style={{
          ...buttonStyle,
          bottom: '20px',
          right: '20px',
          display: selectedObject ? 'flex' : 'none',
        }}
      >
        Reset
      </button>
      <button
        onClick={() => {
          console.log('Select object clicked:', selectedObject);
          onSelectObject(selectedObject);
        }}
        style={{
          ...buttonStyle,
          bottom: '20px',
          left: '20px',
          display: selectedObject ? 'flex' : 'none',
        }}
      >
        {selectedObject ? selectedObject.class : 'None'}
      </button>
    </div>
  );
}

export default ARVideoFeed;