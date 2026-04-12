import React from 'react';
import StarField from './StarField';
import AgentPoints from './AgentPoints';
import AgentTrails from './AgentTrails';
import EventParticles from './EventParticles';
import PostFX from './PostFX';
import ZoomIndicator from '../hud/ZoomIndicator';

export default function Scene() {
  return (
    <>
      <StarField />
      <AgentTrails />
      <AgentPoints />
      <EventParticles />
      <PostFX />
      <ZoomIndicator />
    </>
  );
}
