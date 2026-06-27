import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Settings, Plus, Trash2, Loader } from 'lucide-react';

interface Session {
  sessionId: string;
  mtime: number;
  projectKey: string;
}

interface SidebarProps {
  isOpen: boolean;
  activeSessionId: string | undefined;
  onNewChat: () => void;
   onSelectSession: (session: { sessionId: string; projectKey: string }) => void;
  onDeleteSession: (sessionId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:4000/api/sessions');
      if (res.ok) {
        const data: Session[] = await res.json();
        setSessions(data);
      }
    } catch {
      // Backend not reachable yet
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on open and refresh when active session changes (new session created)
  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen, activeSessionId, fetchSessions]);

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await fetch(`http://localhost:4000/api/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      onDeleteSession(sessionId);
    } catch {
      // ignore
    }
  };

  const formatTime = (mtime: number) => {
    const d = new Date(mtime);
    const now = new Date();
    const diffH = (now.getTime() - d.getTime()) / 3600000;
    if (diffH < 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <motion.div
      initial={false}
      animate={{ width: isOpen ? 260 : 0, opacity: isOpen ? 1 : 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      style={{
        overflow: 'hidden',
        borderRight: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color)' }}>
        <button
          id="new-chat-btn"
          className="icon-btn"
          onClick={onNewChat}
          style={{
            width: '100%',
            justifyContent: 'flex-start',
            gap: '8px',
            padding: '10px 12px',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            fontSize: '14px',
          }}
        >
          <Plus size={16} />
          New Chat
        </button>
      </div>

      {/* Sessions list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '8px 8px 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Recent Sessions
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px', color: 'var(--text-secondary)' }}>
            <Loader size={16} className="animate-spin" />
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '13px', opacity: 0.6 }}>
            No sessions yet
          </div>
        )}

        {sessions.map((s) => {
          const isActive = s.sessionId === activeSessionId;
          return (
            <div
              key={s.sessionId}
                            onClick={() => onSelectSession({ sessionId: s.sessionId, projectKey: s.projectKey })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                backgroundColor: isActive ? 'rgba(59,130,246,0.12)' : 'transparent',
                border: isActive ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                marginBottom: '2px',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              <MessageSquare size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.sessionId.slice(0, 18)}…
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {formatTime(s.mtime)}
                </div>
              </div>
              <button
                className="icon-btn"
                onClick={(e) => handleDelete(e, s.sessionId)}
                style={{ padding: '4px', opacity: 0.5, flexShrink: 0 }}
                title="Delete session"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)' }}>
        <button className="icon-btn" style={{ width: '100%', justifyContent: 'flex-start', gap: '8px', fontSize: '14px' }}>
          <Settings size={16} />
          Settings
        </button>
      </div>
    </motion.div>
  );
};
