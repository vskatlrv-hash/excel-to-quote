'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect, useMemo } from 'react';
import type { QuoteAnalysis } from '@/types/quote';

interface ChatbotProps {
    analysis: QuoteAnalysis | null;
}

export default function Chatbot({ analysis }: ChatbotProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const welcomeMessage = useMemo(() => {
        if (!analysis) return null;
        return `I've analyzed your file "${analysis.fileName}". I found ${analysis.summary.totalRows} line items with ${analysis.summary.totalRisks} risks detected (${analysis.summary.criticalRisks} critical, ${analysis.summary.highRisks} high). How can I help you with this quote?`;
    }, [analysis]);

    const { messages, sendMessage, status, error } = useChat({
        transport: new DefaultChatTransport({
            api: '/api/chat',
        }),
    });

    const isLoading = status === 'streaming' || status === 'submitted';

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const toggleChat = () => setIsOpen(!isOpen);

    const suggestedQuestions = [
        "Explain the Incoterms risks",
        "How to handle LD clauses?",
        "Summarize the quote data",
        "What should I negotiate?",
    ];

    const handleSuggestion = (question: string) => {
        setInputValue(question);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading) return;

        const message = inputValue;
        setInputValue('');
        await sendMessage({ text: message });
    };

    // Get display text from message parts
    const getMessageText = (message: { parts?: Array<{ type: string; text?: string }> }): string => {
        if (message.parts && message.parts.length > 0) {
            return message.parts
                .filter((part): part is { type: 'text'; text: string } => part.type === 'text' && !!part.text)
                .map(part => part.text)
                .join('');
        }
        return '';
    };

    // Combine welcome message with actual messages
    const displayMessages = useMemo(() => {
        const allMessages: Array<{ id: string; role: string; text: string }> = [];

        if (welcomeMessage && messages.length === 0) {
            allMessages.push({
                id: 'welcome',
                role: 'assistant',
                text: welcomeMessage,
            });
        }

        messages.forEach((msg) => {
            allMessages.push({
                id: msg.id,
                role: msg.role,
                text: getMessageText(msg),
            });
        });

        return allMessages;
    }, [messages, welcomeMessage]);

    return (
        <>
            {/* Chat Toggle Button */}
            <button
                className={`chat-toggle-btn ${isOpen ? 'open' : ''}`}
                onClick={toggleChat}
                aria-label="Toggle chat"
            >
                {isOpen ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                )}
                {!isOpen && displayMessages.length > 0 && (
                    <span className="chat-badge">{displayMessages.length}</span>
                )}
            </button>

            {/* Chat Panel */}
            <div className={`chat-panel ${isOpen ? 'open' : ''}`}>
                <div className="chat-header">
                    <div className="chat-header-info">
                        <div className="chat-avatar">🤖</div>
                        <div>
                            <h4>Quote Copilot AI</h4>
                            <span className="chat-status">
                                {isLoading ? 'Thinking...' : 'Powered by Gemini'}
                            </span>
                        </div>
                    </div>
                    <button className="chat-close-btn" onClick={toggleChat}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="chat-messages">
                    {displayMessages.length === 0 && (
                        <div className="chat-welcome">
                            <div className="welcome-icon">💬</div>
                            <h4>How can I help?</h4>
                            <p>Ask me about your quote data, risks, or negotiation strategies.</p>
                            <div className="suggested-questions">
                                {suggestedQuestions.map((q, i) => (
                                    <button key={i} onClick={() => handleSuggestion(q)}>
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {displayMessages.map((message) => (
                        <div
                            key={message.id}
                            className={`chat-message ${message.role === 'user' ? 'user' : 'assistant'}`}
                        >
                            <div className="message-avatar">
                                {message.role === 'user' ? '👤' : '🤖'}
                            </div>
                            <div className="message-content">
                                <div className="message-text">{message.text}</div>
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="chat-message assistant">
                            <div className="message-avatar">🤖</div>
                            <div className="message-content">
                                <div className="typing-indicator">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="chat-error">
                            <span>⚠️ {error.message || 'Failed to send message'}</span>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                <form className="chat-input-form" onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Ask about your quote..."
                        disabled={isLoading}
                    />
                    <button type="submit" disabled={isLoading || !inputValue.trim()}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22,2 15,22 11,13 2,9 22,2" />
                        </svg>
                    </button>
                </form>
            </div>
        </>
    );
}
