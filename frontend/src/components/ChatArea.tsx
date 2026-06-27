import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, User } from 'lucide-react';

export type Message = {
  id: number;
  role: 'user' | 'agent' | 'system' | 'tool' | 'error';
  content: string;
};

interface ChatAreaProps {
  messages: Message[];
  processing: boolean;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ messages, processing }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, processing]);

  const displayMessages = messages.filter(m => m.role === 'user' || m.role === 'agent' || m.role === 'error');

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {displayMessages.length === 0 && (
          <div style={{ textAlign: 'center', opacity: 0.5, marginTop: '20vh' }}>
            <h2>How can I help you today?</h2>
          </div>
        )}
        
        {displayMessages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', gap: '16px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
            <div style={{ 
              width: '36px', height: '36px', borderRadius: '50%', 
              backgroundColor: msg.role === 'user' ? 'var(--accent-color)' : 'var(--bg-secondary)',
              border: msg.role !== 'user' ? '1px solid var(--border-color)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              {msg.role === 'user' ? <User size={20} color="white" /> : <Bot size={20} />}
            </div>
            
            <div style={{ 
              backgroundColor: msg.role === 'user' ? 'var(--user-msg-bg)' : 'transparent',
              padding: msg.role === 'user' ? '12px 16px' : '6px 0',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '85%',
              color: msg.role === 'error' ? 'var(--error)' : 'inherit',
              lineHeight: 1.6
            }} className="prose">
              {msg.role === 'agent' ? (
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              ) : (
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              )}
            </div>
          </div>
        ))}

        {processing && (
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={20} />
            </div>
            <div style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="dot-flashing"></span>
              <span style={{ opacity: 0.5, fontSize: '14px', marginLeft: '12px' }}>Agent is thinking...</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
};
