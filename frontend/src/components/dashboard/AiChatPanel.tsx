import React, { useState } from 'react';
import { Bot, Send, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

interface Props {
  onHighlightOriginNode?: (nodeId: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  originNodeId?: string;
  coordinationFlags?: Array<{ cluster_ip: string; user_ids: string[] }>;
  timestamp: string;
}

export const AiChatPanel: React.FC<Props> = ({ onHighlightOriginNode }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-0',
      sender: 'assistant',
      text: 'Hello Analyst. I am your GraphRAG Forensic AI. Ask me any question about the currently filtered sub-graph (e.g., origin node detection, shared IP coordination, narrative propagation).',
      timestamp: 'Just now',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const samplePrompts = [
    'Where did this narrative originate?',
    'Which accounts look coordinated on the same IP?',
    'Summarize threat activity in the active date window.',
  ];

  const handleSend = (questionText?: string) => {
    const q = questionText || input;
    if (!q.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!questionText) setInput('');
    setIsLoading(true);

    setTimeout(() => {
      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: `Based on sub-graph structural analysis: 3 accounts (@shadow_bot01, @shadow_bot02, @shadow_bot03) posted duplicate text targeting #BotnetDetected within a 5-minute window from shared IP 192.0.2.100. Likely origin node identified as Post #p_002.`,
        originNodeId: 'p_002',
        coordinationFlags: [{ cluster_ip: '192.0.2.100', user_ids: ['u_004', 'u_005', 'u_006'] }],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="og-card overflow-hidden shadow-panel">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full og-card-header bg-slate-900/60 hover:bg-slate-800/50 transition-colors text-left cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white glow-cyan">
            <Bot className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-mono font-bold text-white tracking-wide">
                GraphRAG Forensic Analyst
              </h3>
              <span className="og-badge-cyan">AI Assistant</span>
              <span className="og-badge-muted hidden sm:inline-flex">Simulated · Phase 3 API</span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
              Natural-language reasoning over the active sub-graph
            </p>
          </div>
        </div>
        <span className="text-slate-400 p-1 shrink-0" aria-hidden>
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </span>
      </button>

      {isOpen && (
        <div className="p-4 flex flex-col gap-4 border-t border-slate-800/80 bg-slate-950/30">
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 max-h-[240px] min-h-[120px]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[85%] p-3 rounded-xl text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-cyan-600/90 text-white rounded-br-sm shadow-md'
                      : 'bg-slate-800/90 text-slate-200 border border-slate-700/60 rounded-bl-sm'
                  }`}
                >
                  <p>{msg.text}</p>
                  {msg.originNodeId && (
                    <div className="mt-2 pt-2 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] text-cyan-300 font-mono inline-flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" strokeWidth={1.75} />
                        Origin Node: {msg.originNodeId}
                      </span>
                      <button
                        type="button"
                        onClick={() => onHighlightOriginNode?.(msg.originNodeId!)}
                        className="og-btn-ghost py-0.5 px-2 text-[10px] hover:border-cyan-700/50 hover:text-cyan-300"
                      >
                        Highlight on Canvas
                      </button>
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-slate-500 font-mono mt-1 px-1">{msg.timestamp}</span>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono p-2.5 og-card max-w-[220px] animate-pulse">
                <Bot className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                <span>Extracting sub-graph...</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {samplePrompts.map((p, idx) => (
              <button key={idx} type="button" onClick={() => handleSend(p)} className="og-chip">
                {p}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-stretch sm:items-center gap-2 pt-3 border-t border-slate-800/80"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about origin, coordination, or threat activity in the filtered graph..."
              className="og-input flex-1 min-h-[40px] py-2.5"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="og-btn-primary min-h-[40px] px-4 shrink-0"
            >
              <Send className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
