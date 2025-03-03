import { useState } from 'react';
import ARVideoFeed from './components/ARVideoFeed';
import ObjectSelector from './components/ObjectSelector';

function App() {
  const [arSession, setARSession] = useState(null);
  const [detectedObjects, setDetectedObjects] = useState([]);
  const [selectedObject, setSelectedObject] = useState(null);

  const handleCanvasClick = (x, y) => {
    // Trigger detection on click, to be processed in ARVideoFeed
    setDetectedObjects([]); // Clear previous detections
  };

  const reset = () => {
    setARSession(null);
    setDetectedObjects([]);
    setSelectedObject(null);
    if (arSession) {
      arSession.end();
    }
  };

  return (
    <div>
      <ARVideoFeed
        arSession={arSession}
        setARSession={setARSession}
        setDetectedObjects={setDetectedObjects}
        selectedObject={selectedObject}
        onCanvasClick={handleCanvasClick}
      />
      <ObjectSelector
        detectedObjects={detectedObjects}
        setSelectedObject={setSelectedObject}
      />
      <button onClick={reset}>Reset</button>
    </div>
  );
}

export default App;