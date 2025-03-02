// src/App.jsx
import React from 'react';
import WebcamFeed from './components/WebcamFeed';
import MeasurementsDisplay from './components/MeasurementsDisplay';
import useObjectDetection from './hooks/useObjectDetection';

function App() {
  const { predictions, selectedObject, detectObjects, handleCanvasClick } =
    useObjectDetection();

  return (
    <div style={{ padding: '20px' }}>
      <h1>Object Detection and Measurement Estimation</h1>
      <WebcamFeed
        onDetect={detectObjects}
        onCanvasClick={handleCanvasClick}
        predictions={predictions}
        selectedObject={selectedObject}
      />
      <MeasurementsDisplay selectedObject={selectedObject} />
    </div>
  );
}

export default App;