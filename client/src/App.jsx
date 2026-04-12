import React from 'react';
import SimulationProvider from './components/SimulationProvider';
import UniverseCanvas from './components/UniverseCanvas';

export default function App() {
  return (
    <SimulationProvider>
      <UniverseCanvas />
    </SimulationProvider>
  );
}
