'use client';

import { useEffect, useState, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import { motion } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen, Activity } from 'lucide-react';

import { Sidebar } from '@/components/Sidebar';
import { ChatArea, Message } from '@/components/ChatArea';
import { ActivityPanel } from '@/components/ActivityPanel';
import { InputArea } from '@/components/InputArea';
import { PermissionModal } from '@/components/PermissionModal';

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [processing, setProcessing] = useState(false);
  // activeSessionId is the source of truth — only set by server (session_init)
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>();
  const [permissionRequest, setPermissionRequest] = useState<{ question: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(true);

  const socketRef = useRef<Socket | null>(null);
  const nextMsgId = useRef(1);

  const addMessage = (role: Message['role'], content: string) => {
    setMessages((prev) => [...prev, { id: nextMsgId.current++, role, content }]);
  };

  useEffect(() => {
    const socket = io('http://localhost:4000');
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setProcessing(false);
    });

    socket.on('agent_processing', () => setProcessing(true));
    socket.on('agent_done', () => setProcessing(false));

    // Server assigned a real session ID — store it as the authoritative ID
    socket.on('session_init', (sid: string) => {
      setActiveSessionId(sid);
      addMessage('system', `Session started: ${sid}`);
    });

    socket.on('session_set', (sid: string) => {
      setActiveSessionId(sid);
      addMessage('system', `Resumed session: ${sid}`);
    });

        socket.on('session_history', (historyMessages: any[]) => {
      setMessages(historyMessages.map((msg) => ({
        id: nextMsgId.current++,
        role: msg.role,
        content: msg.content
      })));
    });

    socket.on('session_cleared', () => {
      setActiveSessionId(undefined);
      setMessages([]);
      nextMsgId.current = 1;
    });

    socket.on('agent_message', (payload: any) => {
      if (payload.type === 'assistant') addMessage('agent', payload.text);
      else if (payload.type === 'tool') addMessage('tool', payload.text);
      else if (payload.type === 'result') addMessage('system', `✓ Done (${payload.text})`);
      else if (payload.type === 'error') addMessage('error', payload.text ?? 'Unknown error');
    });

    socket.on('ask_permission', (payload: { question: string }) => {
      setPermissionRequest(payload);
    });

    return () => { socket.disconnect(); };
  }, []);

  const sendMessage = () => {
    if (!input.trim() || !socketRef.current) return;
    addMessage('user', input);
    // Only send sessionId on the FIRST message of a resumed session
    // After that the server tracks it internally
    socketRef.current.emit('chat_message', {
      prompt: input,
      // Send session ID only when resuming (server will ignore if it already has one)
      sessionId: activeSessionId,
    });
    setInput('');
  };

  const handleNewChat = () => {
    socketRef.current?.emit('new_chat');
    // Optimistic clear — server will confirm with session_cleared
    setActiveSessionId(undefined);
    setMessages([]);
    nextMsgId.current = 1;
  };

   const handleSelectSession = (session: { sessionId: string; projectKey: string }) => {
    if (session.sessionId === activeSessionId) return;
    // Clear current messages and load the selected session
    setMessages([]);
    nextMsgId.current = 1;
    setActiveSessionId(session.sessionId);
    socketRef.current?.emit('set_session', session);
  };

  const handleDeleteSession = (sessionId: string) => {
    if (sessionId === activeSessionId) {
      handleNewChat();
    }
  };

  const respondPermission = (allow: boolean) => {
    socketRef.current?.emit('permission_response', allow);
    setPermissionRequest(null);
  };

  return (
    <div className="layout-container">
      <Sidebar
        isOpen={sidebarOpen}
        activeSessionId={activeSessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{
          height: '48px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0,
          backgroundColor: 'var(--bg-color)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button id="sidebar-toggle" className="icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            </button>
            <span style={{ fontWeight: 600, fontSize: '15px' }}>Revcon Agent</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {activeSessionId && (
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                {activeSessionId.slice(0, 20)}…
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: isConnected ? 'var(--success)' : 'var(--error)' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: isConnected ? 'var(--success)' : 'var(--error)' }} />
              {isConnected ? 'Connected' : 'Offline'}
            </div>
            <button id="activity-toggle" className="icon-btn" onClick={() => setActivityOpen(!activityOpen)} title="Toggle Activity Panel">
              <Activity size={20} />
            </button>
          </div>
        </div>

        {/* Chat + Activity */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <ChatArea messages={messages} processing={processing} />
            <InputArea
              input={input}
              setInput={setInput}
              onSend={sendMessage}
              disabled={processing || !isConnected || !!permissionRequest}
              sessionId={activeSessionId}
            />
          </div>

          <motion.div
            animate={{ width: activityOpen ? 320 : 0, opacity: activityOpen ? 1 : 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden', flexShrink: 0 }}
          >
            <ActivityPanel messages={messages} />
          </motion.div>
        </div>
      </div>

      {permissionRequest && (
        <PermissionModal
          question={permissionRequest.question}
          onAllow={() => respondPermission(true)}
          onDeny={() => respondPermission(false)}
        />
      )}
    </div>
  );
}
