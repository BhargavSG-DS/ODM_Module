function NetworkInfo() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      background: 'rgba(0,0,0,0.8)',
      color: '#00ff00',
      padding: '10px',
      fontFamily: 'monospace',
      fontSize: '14px',
      zIndex: 9999
    }}>
      <p>Access from your phone:</p>
      <p>https://{window.location.hostname}:5173</p>
    </div>
  );
}

export default NetworkInfo;
