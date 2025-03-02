// src/components/MeasurementsDisplay.jsx
import React from 'react';

const MeasurementsDisplay = ({ selectedObject }) => {
  if (!selectedObject) return null;

  const [x, y, width, height] = selectedObject.bbox;
  const measurements = { length: width, breadth: height };

  return (
    <div>
      <p>Estimated Length: {measurements.length}px</p>
      <p>Estimated Breadth: {measurements.breadth}px</p>
    </div>
  );
};

export default MeasurementsDisplay;