import { useState, useEffect } from 'react';

function DeviceDebugPanel() {
  const [deviceInfo, setDeviceInfo] = useState({});
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);

  useEffect(() => {
    async function getDeviceInfo() {
      try {
        // Get device capabilities
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput');
        setVideoDevices(cameras);

        // Get device info
        const info = {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          vendor: navigator.vendor,
          language: navigator.language,
          deviceMemory: navigator.deviceMemory,
          hardwareConcurrency: navigator.hardwareConcurrency,
          screenSize: `${window.screen.width}x${window.screen.height}`,
          pixelRatio: window.devicePixelRatio,
          connection: navigator.connection?.effectiveType || 'unknown'
        };
        setDeviceInfo(info);
      } catch (error) {
        console.error('Error getting device info:', error);
      }
    }

    getDeviceInfo();
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      background: 'rgba(0,0,0,0.8)',
      color: '#00ff00',
      padding: '10px',
      maxWidth: '300px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 1000
    }}>
      <h3>📱 Device Debug</h3>
      <select 
        onChange={(e) => setSelectedDevice(e.target.value)}
        style={{ width: '100%', marginBottom: '10px' }}
      >
        <option value="">Select Camera</option>
        {videoDevices.map(device => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `Camera ${device.deviceId.slice(0,8)}`}
          </option>
        ))}
      </select>
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {Object.entries(deviceInfo).map(([key, value]) => (
          <div key={key}>
            <strong>{key}:</strong> {value}
          </div>
        ))}
      </div>
    </div>
  );
}

export default DeviceDebugPanel;
