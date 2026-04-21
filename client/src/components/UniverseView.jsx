import React, { useEffect, useState } from 'react';
import { useUniverseStore } from '../store/universeStore';
import { messages as messagesApi } from '../api/messages';
import { artifacts as artifactsApi } from '../api/artifacts';
import { sessions as sessionsApi } from '../api/sessions';
import PanelSwitcher from './PanelSwitcher';
import RefineInput from './RefineInput';
import ChatPanel from './chat/ChatPanel';
import VisualPanel from './visual/VisualPanel';
import DashboardPanel from './dashboard/DashboardPanel';

export default function UniverseView({ onExit }) {
  const { panel, activeUniverse, activeUniverseId, connected, setMessages, setArtifacts, sessionStatus, setSessionStatus } = useUniverseStore();
  const [sessionLoading, setSessionLoading] = useState(false);

  // Load initial messages, artifacts, and session status
  useEffect(() => {
    if (!activeUniverseId) return;
    messagesApi.list(activeUniverseId, { limit: 100 })
      .then(d => setMessages(d.messages || []))
      .catch(() => {});
    artifactsApi.list(activeUniverseId)
      .then(d => setArtifacts(d.artifacts || []))
      .catch(() => {});
    sessionsApi.get(activeUniverseId)
      .then(d => setSessionStatus(d.status || 'stopped'))
      .catch(() => setSessionStatus('stopped'));
  }, [activeUniverseId]);

  async function handleRun() {
    if (sessionLoading) return;
    setSessionLoading(true);
    try {
      if (sessionStatus === 'paused') {
        await sessionsApi.resume(activeUniverseId);
        setSessionStatus('running');
      } else if (sessionStatus === 'stopped') {
        await sessionsApi.start(activeUniverseId);
        setSessionStatus('running');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSessionLoading(false);
    }
  }

  async function handlePause() {
    if (sessionLoading) return;
    setSessionLoading(true);
    try {
      await sessionsApi.pause(activeUniverseId);
      setSessionStatus('paused');
    } catch (err) {
      alert(err.message);
    } finally {
      setSessionLoading(false);
    }
  }

  async function handleStop() {
    if (sessionLoading) return;
    setSessionLoading(true);
    try {
      await sessionsApi.stop(activeUniverseId);
      setSessionStatus('stopped');
    } catch (err) {
      alert(err.message);
    } finally {
      setSessionLoading(false);
    }
  }

  const statusColor = sessionStatus === 'running' ? '#86efac' : sessionStatus === 'paused' ? '#fbbf24' : '#6b7280';
  const statusLabel = sessionStatus === 'running' ? '● RUNNING' : sessionStatus === 'paused' ? '⏸ PAUSED' : '■ STOPPED';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#04000a' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', borderBottom: '1px solid rgba(168,85,247,0.15)',
        background: 'rgba(4,0,10,0.9)', flexShrink: 0,
      }}>
        <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#e2d9f3' }}>
          {activeUniverse?.name || 'Universe'}
        </div>
        <PanelSwitcher />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Session status badge */}
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: statusColor, minWidth: 72 }}>
            {statusLabel}
          </span>

          {/* Session control buttons */}
          {sessionStatus !== 'running' && (
            <button
              onClick={handleRun}
              disabled={sessionLoading}
              title="Run"
              style={{ background: 'none', border: '1px solid rgba(134,239,172,0.4)', borderRadius: 4, color: '#86efac', fontFamily: 'monospace', fontSize: 11, padding: '2px 8px', cursor: 'pointer', opacity: sessionLoading ? 0.5 : 1 }}>
              ▶ Run
            </button>
          )}
          {sessionStatus === 'running' && (
            <button
              onClick={handlePause}
              disabled={sessionLoading}
              title="Pause"
              style={{ background: 'none', border: '1px solid rgba(251,191,36,0.4)', borderRadius: 4, color: '#fbbf24', fontFamily: 'monospace', fontSize: 11, padding: '2px 8px', cursor: 'pointer', opacity: sessionLoading ? 0.5 : 1 }}>
              ⏸ Pause
            </button>
          )}
          {sessionStatus !== 'stopped' && (
            <button
              onClick={handleStop}
              disabled={sessionLoading}
              title="Stop"
              style={{ background: 'none', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 4, color: '#f87171', fontFamily: 'monospace', fontSize: 11, padding: '2px 8px', cursor: 'pointer', opacity: sessionLoading ? 0.5 : 1 }}>
              ■ Stop
            </button>
          )}

          <span style={{ fontFamily: 'monospace', fontSize: 10, color: connected ? '#86efac' : '#f87171', marginLeft: 4 }}>
            {connected ? '◉' : '○'}
          </span>
          <button onClick={onExit} style={{ background: 'none', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 4, color: '#6b7280', fontFamily: 'monospace', fontSize: 11, padding: '2px 8px', cursor: 'pointer' }}>
            ← Universes
          </button>
        </div>
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {panel === 'chat'      && <ChatPanel />}
        {panel === 'visual'    && <VisualPanel />}
        {panel === 'dashboard' && <DashboardPanel />}
      </div>

      {/* Refine input — always visible */}
      <RefineInput />
    </div>
  );
}
