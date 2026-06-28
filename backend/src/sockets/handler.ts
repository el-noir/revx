import { Server, Socket } from 'socket.io';
import { runAgentQuery, sessionStore } from '../agent/index.js';

export const registerSocketHandlers = (io: Server, socket: Socket) => {

    let currentSessionId: string | undefined = undefined;
    let currentProjectKey: string | undefined = undefined; // set when resuming an old session

    socket.on('chat_message', async (data: { prompt: string, sessionId?: string }) => {
        const { prompt, sessionId } = data;

        if (sessionId && !currentSessionId) {
            currentSessionId = sessionId;
        }

        console.log(`[Message Received] socket=${socket.id} session=${currentSessionId ?? 'new'}: ${prompt.slice(0, 60)}`);

        socket.emit('agent_processing');

        await runAgentQuery(
            prompt,
            currentSessionId,
            socket,
            
            (sid: string) => {
                currentSessionId = sid;
                currentProjectKey = undefined; // SDK manages the project key now
                console.log(`[Session Assigned] socket=${socket.id} -> ${sid}`);
            },
            currentProjectKey, 
        );
    });

   
     socket.on('set_session', async (data: { sessionId: string; projectKey: string }) => {
        currentSessionId = data.sessionId;
        currentProjectKey = data.projectKey;
        console.log(`[Session Set] socket=${socket.id} -> ${data.sessionId} (${data.projectKey})`);
        socket.emit('session_set', data.sessionId);

                try {
            const entries = await sessionStore.load({ sessionId: data.sessionId, projectKey: data.projectKey });
            if (entries) {
                const historyMessages: { role: string; content: string }[] = [];
                for (const entry of entries) {
                   const msg: any = entry.message;
                   if(entry.type === 'user' && msg?.content){
                        let userText = '';
                        if (Array.isArray(msg.content)) {
                            // Filter out tool_result blocks so we only show the actual user prompt
                            userText = msg.content
                                .filter((c: any) => c.type === 'text')
                                .map((c: any) => c.text)
                                .join('\n');
                        } else if (typeof msg.content === 'string') {
                            userText = msg.content;
                        }
                        if (userText.trim()) {
                            historyMessages.push({ role: 'user', content: userText });
                        }
                    } else if (entry.type === 'assistant' && msg?.content) {
                        let assistantText = '';
                        if (Array.isArray(msg.content)) {
                            assistantText = msg.content
                                .filter((c: any) => c.type === 'text')
                                .map((c: any) => c.text)
                                .join('\n');
                            
                            const toolUses = msg.content.filter((c: any) => c.type === 'tool_use');
                            if (assistantText.trim()) {
                                historyMessages.push({ role: 'agent', content: assistantText });
                            }
                            
                            for (const t of toolUses) {
                                if (t.name === 'Agent' || t.name === 'Task') {
                                    const subType = t.input?.subagent_type ?? t.input?.agent ?? 'unknown';
                                    historyMessages.push({ role: 'tool', content: `\n [Dispatching Subagent: ${subType}]` });
                                } else {
                                    historyMessages.push({ role: 'tool', content: `\n [Calling Tool: ${t.name}]` });
                                }
                            }
                        } else if (typeof msg.content === 'string') {
                            assistantText = msg.content;
                            if (assistantText.trim()) {
                                historyMessages.push({ role: 'agent', content: assistantText });
                            }
                        }
                    }
                }
                socket.emit('session_history', historyMessages);
            }
        } catch (err) {
            console.error('Error loading session history:', err);
        }

    });

    socket.on('new_chat', () => {
        currentSessionId = undefined;
        currentProjectKey = undefined;
        console.log(`[New Chat] socket=${socket.id}`);
        socket.emit('session_cleared');
    });
};
