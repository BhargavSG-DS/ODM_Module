function ObjectSelector({ detectedObjects, setSelectedObject }) {
    console.log('ObjectSelector, detectedObjects:', detectedObjects); // Debug
    return (
      <div>
        <h3>Detected Object:</h3>
        {detectedObjects.length > 0 ? (
          <p onClick={() => {
            console.log('Setting selectedObject:', detectedObjects[0]);
            setSelectedObject(detectedObjects[0]);
          }}>
            {detectedObjects[0].class} selected. Click here to confirm.
          </p>
        ) : (
          <p>No object detected. Click on an object in the video feed.</p>
        )}
      </div>
    );
  }
  
  export default ObjectSelector;