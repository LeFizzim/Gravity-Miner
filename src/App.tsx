import React from 'react';
import GameCanvas from './components/GameCanvas';
import './App.css'; // Keep existing styles or modify as needed

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', margin: 0 }}>
      <GameCanvas />
    </div>
  );
}

export default App;