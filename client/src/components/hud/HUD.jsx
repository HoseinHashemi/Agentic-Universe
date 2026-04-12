import React from 'react';
import TopBar from './TopBar';
import StatsPanel from './StatsPanel';
import AgentTooltip from './AgentTooltip';
import UniverseSidebar from './UniverseSidebar';
import BottomScrubber from './BottomScrubber';

// ZoomIndicator lives inside the R3F canvas (needs useThree), mounted via Scene.jsx

export default function HUD() {
  return (
    <div style={{ pointerEvents: 'none' }}>
      <TopBar />
      <StatsPanel />
      <AgentTooltip />
      <UniverseSidebar />
      <BottomScrubber />
    </div>
  );
}
