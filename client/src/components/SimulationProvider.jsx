import React, { useEffect, useRef } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { useUiStore } from '../store/uiStore';
import { instances } from '../api/instances';
import { snapshots } from '../api/snapshots';

const BASE_TICK_INTERVAL = 200; // ms, matches server default

export default function SimulationProvider({ children }) {
  const ws = useRef(null);
  const retryDelay = useRef(1000);
  const retryTimer = useRef(null);

  const { setConnected, applyTick, setInstance } = useSimulationStore();
  const { setSnapshots } = useUiStore();

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

      if (type === 'welcome') {
        const inst = payload.instances?.[0];
        if (inst) {
          setInstance({
            instanceId: inst.instanceId,
            universeId: inst.universeId,
            universeName: inst.universeConfig?.name ?? '',
          });
          applyTick(inst);
          // Load snapshots for the scrubber if we have a universeId
          if (inst.universeId && inst.universeId !== 'simple-ecosystem') {
            snapshots.list(inst.universeId, { limit: 200 }).then(d => {
              setSnapshots(d.snapshots ?? []);
            }).catch(() => {});
          }
        }
        return;
      }

      if (type === 'tick') {
        // Only apply if in live mode
        if (useSimulationStore.getState().playbackMode === 'live') {
          applyTick(payload);
        }
        return;
      }

      if (type === 'started') {
        useSimulationStore.setState({ running: true });
        return;
      }
      if (type === 'stopped') {
        useSimulationStore.setState({ running: false });
        return;
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
