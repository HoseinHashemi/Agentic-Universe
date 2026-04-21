import React, { useEffect, useState } from 'react';
import UniverseProvider from './providers/UniverseProvider';
import { useUniverseStore } from './store/universeStore';
import { universes as universesApi } from './api/universes';
import { agents as agentsApi } from './api/agents';
import CreateUniverse from './components/CreateUniverse';
import UniverseView from './components/UniverseView';

const STORAGE_KEY = 'agentic_active_universe';

function AppInner() {
  const { activeUniverseId, setActiveUniverse, clearActiveUniverse } = useUniverseStore();
  const [restoring, setRestoring] = useState(true);

  // Restore active universe from localStorage on mount
  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (!savedId) { setRestoring(false); return; }
    Promise.all([
      universesApi.get(savedId),
      agentsApi.list(savedId),
    ])
      .then(([uData, aData]) => {
        setActiveUniverse({ universe: uData.universe, agents: aData.agents || [], session: null });
      })
      .catch(() => localStorage.removeItem(STORAGE_KEY))
      .finally(() => setRestoring(false));
  }, []);

  // Persist active universe id to localStorage
  useEffect(() => {
    if (activeUniverseId) {
      localStorage.setItem(STORAGE_KEY, activeUniverseId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [activeUniverseId]);

  if (restoring) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#04000a', fontFamily: 'monospace', color: '#6b7280', fontSize: 13 }}>
        restoring…
      </div>
    );
  }

  if (activeUniverseId) {
    return <UniverseView onExit={() => { clearActiveUniverse(); }} />;
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
