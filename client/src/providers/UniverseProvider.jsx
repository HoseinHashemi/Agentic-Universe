import React, { useEffect, useRef } from 'react';
import { useUniverseStore } from '../store/universeStore';

export default function UniverseProvider({ children }) {
  const ws = useRef(null);
  const retryDelay = useRef(1000);
  const retryTimer = useRef(null);

  const {
    setConnected, appendMessage, appendAgent, appendArtifact,
    appendEvent, setThinking, clearThinking, setSessionStatus,
  } = useUniverseStore();

  function connect() {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${proto}://${window.location.host}/ws`);
    ws.current = socket;

    socket.onopen = () => {
      setConnected(true);
      retryDelay.current = 1000;
    };

    socket.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      const { type, payload } = msg;

      // Only process events for the active universe
      const activeId = useUniverseStore.getState().activeUniverseId;
      if (payload?.universeId && payload.universeId !== activeId) return;

      switch (type) {
        case 'message_created':
          appendMessage(payload.message);
          break;
        case 'agent_spawned':
          appendAgent(payload.agent);
          break;
        case 'artifact_created':
        case 'artifact_published':
          appendArtifact(payload.artifact);
          break;
        case 'agent_thinking':
          if (payload.thought) {
            clearThinking(payload.agentId);
          } else {
            setThinking(payload.agentId, payload.agentName);
          }
          break;
        case 'agent_action':
          appendEvent({ type: 'agent_action', ...payload, ts: Date.now() });
          break;
        case 'event_processed':
          appendEvent({ type: 'event_processed', ...payload, ts: Date.now() });
          clearThinking(payload.agentId);
          break;
        case 'knowledge_updated':
          useUniverseStore.setState(s => ({
            activeUniverse: s.activeUniverse
              ? { ...s.activeUniverse, knowledge_base: { ...s.activeUniverse.knowledge_base, ...payload.patch } }
              : s.activeUniverse,
          }));
          break;
        case 'session_status':
          setSessionStatus(payload.status);
          break;
        default:
          break;
      }
    };

    socket.onclose = () => {
      setConnected(false);
      retryTimer.current = setTimeout(() => {
        retryDelay.current = Math.min(retryDelay.current * 2, 30_000);
        connect();
      }, retryDelay.current);
    };

    socket.onerror = () => socket.close();
  }

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(retryTimer.current);
      ws.current?.close();
    };
  }, []);

  return children;
}
