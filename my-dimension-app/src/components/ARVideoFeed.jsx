import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { detectObjects } from '../utils/tfUtils';

function ARVideoFeed({ arSession, setARSession, setDetectedObjects, selectedObject, onCanvasClick }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const referenceSpaceRef = useRef(null);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    const initAR = async () => {
      if (!navigator.xr || !(await navigator.xr.isSessionSupported('immersive-ar'))) {
        console.log('WebXR AR not supported. Using 2D mode.');
        return;
      }

      try {
        const session = await navigator.xr.requestSession('immersive-ar', {
          requiredFeatures: ['hit-test', 'local-floor'],
        });
        setARSession(session);

        const canvas = canvasRef.current;
        rendererRef.current = new THREE.WebGLRenderer({ canvas, alpha: true });
        rendererRef.current.setSize(canvas.width, canvas.height);

        sceneRef.current = new THREE.Scene();
        cameraRef.current = new THREE.PerspectiveCamera(70, canvas.width / canvas.height, 0.01, 20);

        session.updateRenderState({ baseLayer: new XRWebGLLayer(session, rendererRef.current) });

        referenceSpaceRef.current = await session.requestReferenceSpace('local-floor');
      } catch (error) {
        console.error('Failed to start AR session:', error);
      }
    };
    if (!arSession) initAR();

    return () => {
      if (arSession) arSession.end();
    };
  }, [arSession, setARSession]);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const renderLoop = () => {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

      if (selectedObject) {
        const obj = selectedObject;
        // Clamp bounding box to canvas dimensions
        const clampedBbox = {
          x: Math.max(0, Math.min(obj.bbox[0], canvasRef.current.width)),
          y: Math.max(0, Math.min(obj.bbox[1], canvasRef.current.height)),
          width: Math.min(obj.bbox[2], canvasRef.current.width - obj.bbox[0]),
          height: Math.min(obj.bbox[3], canvasRef.current.height - obj.bbox[1]),
        };

        // Draw green bounding box
        ctx.strokeStyle = 'green';
        ctx.lineWidth = 2;
        ctx.strokeRect(clampedBbox.x, clampedBbox.y, clampedBbox.width, clampedBbox.height);

        // Adjusted pixel-to-cm ratio (calibrated for accuracy)
        const pixelToCmRatio = 0.007; // Adjusted for 7 cm width ≈ 1000 pixels, tweak as needed
        const widthCm = Math.round(clampedBbox.width * pixelToCmRatio);
        const heightCm = Math.round(clampedBbox.height * pixelToCmRatio);

        // Display dimensions on canvas
        ctx.fillStyle = 'green';
        ctx.font = '16px Arial';
        const widthText = `${widthCm} cm`;
        const heightText = `${heightCm} cm`;
        ctx.fillText(widthText, clampedBbox.x + clampedBbox.width / 2 - ctx.measureText(widthText).width / 2, clampedBbox.y - 10); // Top center
        ctx.save();
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(heightText, -clampedBbox.y - clampedBbox.height / 2 - 20, clampedBbox.x - 10); // Left center
        ctx.restore();

        console.log('Selected object bbox (pixels):', obj.bbox, 'Clamped:', clampedBbox, 'Cm:', widthCm, heightCm);

        // AR mode: Add 3D mesh
        if (arSession && referenceSpaceRef.current) {
          arSession.requestAnimationFrame((time, frame) => {
            const pose = frame.getViewerPose(referenceSpaceRef.current);
            if (pose) {
              const hitTestSource = arSession.requestHitTestSource({ space: referenceSpaceRef.current });
              frame.getHitTestResults(hitTestSource).then((hitResults) => {
                if (hitResults.length > 0) {
                  const hitPose = hitResults[0].getPose(referenceSpaceRef.current);
                  const position = hitPose.transform.position;

                  if (!sceneRef.current.children.length) {
                    const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
                    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                    const cube = new THREE.Mesh(geometry, material);
                    sceneRef.current.add(cube);
                  }

                  const mesh = sceneRef.current.children[0];
                  mesh.position.set(position.x, position.y, position.z);
                  rendererRef.current.render(sceneRef.current, cameraRef.current);
                }
              });
            }
          });
        }
      }

      requestAnimationFrame(renderLoop);
    };
    requestAnimationFrame(renderLoop);
  }, [arSession, selectedObject]);

  const handleCanvasClick = async (e) => {
    if (videoRef.current && videoRef.current.paused) {
      videoRef.current.play().catch((err) => alert('Playback failed:', err));
      return;
    }

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    onCanvasClick(x, y);

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
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: 'auto' }}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: '100%', height: 'auto', display: 'block' }}
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
        }}
      />
    </div>
  );
}

export default ARVideoFeed;