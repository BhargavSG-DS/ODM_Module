import React, { useState, useEffect } from 'react';
import { estimateDistance } from '../utils/distanceUtils';
import { calculateDimensions } from '../utils/dimensionUtils';

const ObjectMarker = ({ object, onSelect, position, canvasWidth, canvasHeight }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [dimensions, setDimensions] = useState(null);
  const [stateDistance, setDistance] = useState(null);

  useEffect(() => {
    if (isHovered) {
      const distance = estimateDistance(object.class, object.bbox[2], canvasWidth);
      setDistance(distance);
      if (distance) {
        const dims = calculateDimensions(
          {
            width: object.bbox[2],
            height: object.bbox[3]
          },
          distance,
          canvasWidth,
          canvasHeight
        );
        setDimensions(dims);
      }
    }
  }, [isHovered, object, canvasWidth, canvasHeight]);

  const handleClick = () => {
    if (object.score >= 0.6) {
      onSelect(object);
    }
  };

  const markerStyle = {
    position: 'absolute',
    left: `${position.x}%`,
    top: `${position.y}%`,
    width: '12px',
    height: '12px',
    backgroundColor: object.score >= 0.6 ? (isHovered ? '#00ff00' : '#ffffff') : '#ff6666',
    border: `2px solid ${object.score >= 0.6 ? '#00ff00' : '#ff6666'}`,
    borderRadius: '50%',
    cursor: object.score >= 0.6 ? 'pointer' : 'not-allowed',
    transform: 'translate(-50%, -50%)',
    zIndex: 15,
    transition: 'all 0.2s ease'
  };

  const tooltipStyle = {
    position: 'absolute',
    top: '-80px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    padding: '8px',
    borderRadius: '4px',
    fontSize: '12px',
    whiteSpace: 'nowrap',
    visibility: isHovered ? 'visible' : 'hidden',
    zIndex: 16,
    minWidth: '150px',
    textAlign: 'center'
  };

  return (
    <div
      style={markerStyle}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={tooltipStyle}>
        <div>{object.class}</div>
        <div>Confidence: {Math.round(object.score * 100)}%</div>
        {dimensions && (
          <>

            <div>Width: {dimensions.width}cm</div>
            <div>Height: {dimensions.height}cm</div>
            <div>Distance: {stateDistance}cm</div>
          </>
        )}
        {object.score < 0.6 && (
          <div style={{ color: '#ff6666', marginTop: '4px' }}>
            Low confidence
          </div>
        )}
      </div>
    </div>
  );
};

export default ObjectMarker;
