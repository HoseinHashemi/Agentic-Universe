import React from 'react';
import UniverseProvider from './providers/UniverseProvider';
import { useUniverseStore } from './store/universeStore';
import CreateUniverse from './components/CreateUniverse';
import UniverseView from './components/UniverseView';

function AppInner() {
  const { activeUniverseId, setActiveUniverse, clearActiveUniverse } = useUniverseStore();

  if (activeUniverseId) {
    return <UniverseView onExit={clearActiveUniverse} />;
  }

  return (
    <CreateUniverse
      onCreated={(data) => {
        setActiveUniverse(data);
      }}
    />
  );
}

export default function App() {
  return (
    <UniverseProvider>
      <AppInner />
    </UniverseProvider>
  );
}
