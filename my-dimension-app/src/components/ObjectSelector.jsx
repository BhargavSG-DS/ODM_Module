function ObjectSelector({ detectedObjects, setSelectedObject }) {
    const handleSelect = (obj) => {
      setSelectedObject(obj);
    };
  
    return (
      <div>
        <h3>Detected Object:</h3>
        {detectedObjects.length > 0 ? (
          <button onClick={() => handleSelect(detectedObjects[0])}>
            {detectedObjects[0].class} ({Math.round(detectedObjects[0].bbox[2] / 10)}cm x {Math.round(detectedObjects[0].bbox[3] / 10)}cm)
          </button>
        ) : (
          <p>No object detected. Click on an object in the video feed.</p>
        )}
      </div>
    );
  }
  
  export default ObjectSelector;