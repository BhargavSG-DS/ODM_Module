import { useState } from 'react';
import ARVideoFeed from './components/ARVideoFeed';
import ObjectSelector from './components/ObjectSelector';

function App() {
  const [arSession, setARSession] = useState(null);
  const [detectedObjects, setDetectedObjects] = useState([]);
  const [selectedObject, setSelectedObject] = useState(null);

  const handleCanvasClick = (x, y) => {
    setDetectedObjects([]);
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div style={{ flex: '1', position: 'relative' }}>
        <ARVideoFeed
          arSession={arSession}
          setARSession={setARSession}
          setDetectedObjects={setDetectedObjects}
          selectedObject={selectedObject}
          onCanvasClick={handleCanvasClick}
        />
      </div>
      <div style={{ padding: '10px', background: '#f0f0f0' }}>
        <ObjectSelector
          detectedObjects={detectedObjects}
          setSelectedObject={setSelectedObject}
        />
        <button onClick={reset}>Reset</button>
      </div>
    </div>
  );
}

export default App;