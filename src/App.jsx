import { useEffect, useState } from 'react';
import axios from 'axios';

function App() {
  const [status, setStatus] = useState('Checking backend...');

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/health`)
      .then((res) => {
        setStatus(res.data.message);
      })
      .catch(() => {
        setStatus('Backend not reachable');
      });
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>ChatApp — Day 1</h1>
      <p>Backend status: <strong>{status}</strong></p>
    </div>
  );
}

export default App;