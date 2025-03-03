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
        console.log('WebXR AR not supported. Falling back to 2D mode.');
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
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

      if (selectedObject) {
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
        } else {
          const obj = selectedObject;
          ctx.strokeStyle = 'red';
          ctx.lineWidth = 2;
          ctx.strokeRect(obj.bbox[0], obj.bbox[1], obj.bbox[2], obj.bbox[3]);
          ctx.fillStyle = 'red';
          ctx.font = '16px Arial';
          ctx.fillText(`${obj.class} (${Math.round(obj.bbox[2] / 10)}cm x ${Math.round(obj.bbox[3] / 10)}cm)`, obj.bbox[0], obj.bbox[1] - 10);
        }
      }

      requestAnimationFrame(renderLoop);
    };
    requestAnimationFrame(renderLoop);
  }, [arSession, selectedObject]);

  const handleCanvasClick = async (e) => {
    if (videoRef.current && videoRef.current.paused) {
      videoRef.current.play().catch((err) => console.error('Playback failed:', err));
      return;
    }

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    onCanvasClick(x, y); // Notify App.jsx

    const objects = await detectObjects(videoRef.current);
    setDetectedObjects(objects);

    // Find the object clicked on
    const clickedObject = objects.find(obj => 
      x >= obj.bbox[0] && x <= obj.bbox[0] + obj.bbox[2] &&
      y >= obj.bbox[1] && y <= obj.bbox[1] + obj.bbox[3]
    );

    if (clickedObject) {
      setDetectedObjects([clickedObject]); // Show only the clicked object
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: 'auto' }} />
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 'auto' }}
      />
    </div>
  );
}

export default ARVideoFeed;