import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, CheckCircle2, CircleDashed, Terminal, ShieldAlert } from 'lucide-react';
import { Message } from './ChatArea';

interface ActivityPanelProps {
  messages: Message[];
}

export const ActivityPanel: React.FC<ActivityPanelProps> = ({ messages }) => {
  const activityMessages = messages.filter(m => m.role === 'tool' || m.role === 'system');

  return (
    <div style={{
      width: 'var(--activity-panel-width)',
      borderLeft: '1px solid var(--border-color)',
      backgroundColor: 'var(--bg-secondary)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Terminal size={18} />
        <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Agent Activity</h3>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <AnimatePresence>
          {activityMessages.length === 0 && (
            <div style={{ opacity: 0.5, fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
              No background activity yet.
            </div>
          )}
          {activityMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              style={{
                fontSize: '13px',
                borderLeft: '2px solid var(--border-color)',
                paddingLeft: '12px',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: msg.content.includes('[TOOL OK]') ? 'var(--success)' : 'var(--text-primary)' }}>
                {msg.content.includes('Error') || msg.role === 'error' ? (
                  <ShieldAlert size={14} color="var(--error)" />
                ) : msg.content.includes('[DONE]') || msg.content.includes('OK') ? (
                  <CheckCircle2 size={14} color="var(--success)" />
                ) : (
                  <CircleDashed size={14} className={msg.role === 'tool' ? 'animate-spin' : ''} />
                )}
                <span style={{ fontWeight: 500 }}>
                  {msg.role === 'tool' ? 'Tool Execution' : 'System'}
                </span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
                {msg.content.slice(0, 150)}
                {msg.content.length > 150 ? '...' : ''}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
