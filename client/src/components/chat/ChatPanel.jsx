import React from 'react';
import MessageThread from './MessageThread';
import MessageInput from './MessageInput';

export default function ChatPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MessageThread />
      <MessageInput />
    </div>
  );
}
