import { useState, useEffect } from 'react';

const DebugLogger = ({ maxLogs = 10 }) => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    // Override console.log
    const originalLog = console.log;
    console.log = (...args) => {
      originalLog.apply(console, args);
      setLogs(prev => [...prev, args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ')].slice(-maxLogs));
    };

    return () => {
      console.log = originalLog;
    };
  }, [maxLogs]);

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      maxHeight: '30vh',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: '#00ff00',
      fontSize: '12px',
      padding: '10px',
      overflow: 'auto',
      zIndex: 1000,
      fontFamily: 'monospace'
    }}>
      {logs.map((log, i) => (
        <div key={i} style={{ margin: '2px 0' }}>
          {log}
        </div>
      ))}
    </div>
  );
};

export default DebugLogger;
