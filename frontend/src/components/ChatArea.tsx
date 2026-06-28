import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, User } from 'lucide-react';

export type Message = {
  id: number;
  role: 'user' | 'agent' | 'system' | 'tool' | 'error' | 'permission' | 'question';
  content: string;
  resolved?: boolean;
  questionPayload?: any;
};

interface ChatAreaProps {
  messages: Message[];
  processing: boolean;
  onRespondPermission?: (msgId: number, allow: boolean) => void;
  onRespondQuestion?: (msgId: number, answers: any) => void;
}

const QuestionForm: React.FC<{ msg: Message, onRespondQuestion?: (id: number, answers: any) => void }> = ({ msg, onRespondQuestion }) => {
  const [answers, setAnswers] = React.useState<Record<string, any>>({});
  
  if (!msg.questionPayload?.questions) return null;

  const handleSelect = (questionText: string, label: string, multiSelect: boolean) => {
    setAnswers(prev => {
      if (!multiSelect) return { ...prev, [questionText]: label };
      const current = prev[questionText] || [];
      if (current.includes(label)) return { ...prev, [questionText]: current.filter((l: string) => l !== label) };
      return { ...prev, [questionText]: [...current, label] };
    });
  };

  const handleSubmit = () => {
    onRespondQuestion?.(msg.id, answers);
  };

  return (
    <div style={{ padding: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', width: '100%', minWidth: '300px' }}>
      <div style={{ fontWeight: 600, marginBottom: '16px', color: 'var(--accent-color)' }}>🤔 {msg.content}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {msg.questionPayload.questions.map((q: any, i: number) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontWeight: 500, fontSize: '14px' }}>{q.question}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {q.options?.map((opt: any, j: number) => {
                const isSelected = q.multiSelect 
                  ? (answers[q.question] || []).includes(opt.label)
                  : answers[q.question] === opt.label;
                
                return (
                  <button 
                    key={j}
                    disabled={msg.resolved}
                    onClick={() => handleSelect(q.question, opt.label, !!q.multiSelect)}
                    style={{ 
                      textAlign: 'left', padding: '10px 12px', 
                      background: isSelected ? 'var(--accent-color)' : 'transparent',
                      color: isSelected ? 'white' : 'inherit',
                      border: `1px solid ${isSelected ? 'var(--accent-color)' : 'var(--border-color)'}`,
                      borderRadius: 'var(--radius-md)', cursor: msg.resolved ? 'default' : 'pointer',
                      display: 'flex', flexDirection: 'column', gap: '2px'
                    }}
                  >
                    <div style={{ fontWeight: 500, fontSize: '13px' }}>{opt.label}</div>
                    {opt.description && <div style={{ fontSize: '12px', opacity: 0.8 }}>{opt.description}</div>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {!msg.resolved ? (
        <button onClick={handleSubmit} style={{ marginTop: '20px', width: '100%', padding: '10px', background: 'var(--accent-color)', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Submit Answers</button>
      ) : (
        <div style={{ marginTop: '16px', color: 'var(--success)', fontSize: '13px', fontWeight: 500 }}>✓ Answers Submitted</div>
      )}
    </div>
  );
};

export const ChatArea: React.FC<ChatAreaProps> = ({ messages, processing, onRespondPermission, onRespondQuestion }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, processing]);

  const displayMessages = messages.filter(m => ['user', 'agent', 'error', 'permission', 'question'].includes(m.role));

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
              {msg.role === 'agent' && <ReactMarkdown>{msg.content}</ReactMarkdown>}
              {(msg.role === 'user' || msg.role === 'error') && <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>}
              {msg.role === 'permission' && (
                <div style={{ padding: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', width: '100%', minWidth: '300px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ⚠️ Permission Required
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '13px', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '16px', wordBreak: 'break-all' }}>
                    {msg.content}
                  </div>
                  {!msg.resolved ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button style={{ flex: 1, padding: '10px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 500 }} onClick={() => onRespondPermission?.(msg.id, false)}>Deny</button>
                      <button style={{ flex: 1, padding: '10px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 500 }} onClick={() => onRespondPermission?.(msg.id, true)}>Allow</button>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--success)', fontSize: '13px', fontWeight: 500 }}>✓ Resolved</div>
                  )}
                </div>
              )}
              {msg.role === 'question' && (
                <QuestionForm msg={msg} onRespondQuestion={onRespondQuestion} />
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
