'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useRef, useEffect, useMemo } from 'react';
import type { QuoteAnalysis } from '@/types/quote';

interface DataUpdateEvent {
    type: 'update_cell' | 'fix_quantities' | 'delete_rows' | 'clear_column';
    rowNumber?: number;
    field?: string;
    newValue?: unknown;
    affectedRows?: number[];
    rowNumbers?: number[]; // For delete_rows
    defaultQuantity?: number;
}

interface AICopilotProps {
    analysis: QuoteAnalysis | null;
    onDataUpdate?: (event: DataUpdateEvent) => void;
}

interface ToolResult {
    toolName: string;
    result: {
        success?: boolean;
        downloadUrl?: string;
        fileName?: string;
        remediationsCount?: number;
        fixedCount?: number;
        affectedRows?: number[];
        message?: string;
        // For update_cell_value
        rowNumber?: number;
        field?: string;
        oldValue?: unknown;
        newValue?: unknown;
        // For delete_rows
        deletedCount?: number;
        rowNumbers?: number[];
        // For clear_column
        affectedCount?: number;
    };
}

export default function AICopilot({ analysis, onDataUpdate }: AICopilotProps) {
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const welcomeMessage = useMemo(() => {
        if (!analysis) return null;
        return `I've analyzed your file "${analysis.fileName}". I found ${analysis.summary.totalRows} line items with ${analysis.summary.totalRisks} risks detected (${analysis.summary.criticalRisks} critical, ${analysis.summary.highRisks} high). How can I help you with this quote?`;
    }, [analysis]);

    const { messages, sendMessage, status, error } = useChat();

    const isLoading = status === 'streaming' || status === 'submitted';

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Suggested questions based on whether file is uploaded
    const suggestedQuestions = useMemo(() => {
        if (analysis) {
            return [
                "Fix the missing quantities",
                "Explain the detected risks",
                "What should I negotiate?",
                "Summarize this quote",
            ];
        }
        return [
            "What can you help me with?",
            "How do I analyze a BOM?",
            "What risks do you detect?",
            "Tell me about Incoterms",
        ];
    }, [analysis]);

    const handleSuggestion = (question: string) => {
        setInputValue(question);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading) return;

        const message = inputValue;
        setInputValue('');

        // Use parts structure as expected by UIMessage in this setup
        // Pass analysis in body option
        await sendMessage(
            {
                role: 'user',
                parts: [{ type: 'text', text: message }]
            },
            {
                body: { analysis }
            }
        );
    };

    // Get display text from message parts
    const getMessageText = (message: { parts?: Array<{ type: string; text?: string; toolName?: string; result?: unknown }> }): string => {
        if (message.parts && message.parts.length > 0) {
            return message.parts
                .filter((part): part is { type: 'text'; text: string } => part.type === 'text' && !!part.text)
                .map(part => part.text)
                .join('');
        }
        return '';
    };

    // Extract tool results from message parts
    // AI SDK v6 format: type="tool-TOOLNAME", state="output-available", output={...}
    const getToolResults = (message: { parts?: Array<{ type: string; toolCallId?: string; state?: string; output?: unknown; result?: unknown }> }): ToolResult[] => {
        if (!message.parts) return [];

        return message.parts
            .filter((part) => {
                // AI SDK v6: type is "tool-TOOLNAME" (e.g., "tool-update_cell_value")
                // and state is "output-available" when the tool has completed
                if (part.type?.startsWith('tool-') && part.state === 'output-available') {
                    return true;
                }
                return false;
            })
            .map(part => {
                // Extract tool name from type (e.g., "tool-update_cell_value" -> "update_cell_value")
                const toolName = part.type.replace(/^tool-/, '');
                const result = (part.output ?? part.result) as ToolResult['result'];
                console.log('[AICopilot] Tool result found:', toolName, result);
                return {
                    toolName,
                    result,
                };
            });
    };

    // Combine welcome message with actual messages
    const displayMessages = useMemo(() => {
        const allMessages: Array<{ id: string; role: string; text: string; toolResults: ToolResult[] }> = [];

        if (welcomeMessage && messages.length === 0) {
            allMessages.push({
                id: 'welcome',
                role: 'assistant',
                text: welcomeMessage,
                toolResults: [],
            });
        }

        messages.forEach((msg) => {
            const text = getMessageText(msg);
            const toolResults = getToolResults(msg);

            allMessages.push({
                id: msg.id,
                role: msg.role,
                text,
                toolResults,
            });
        });

        return allMessages;
    }, [messages, welcomeMessage]);

    // Track which messages we've already processed for data updates
    const processedMessageIdsRef = useRef<Set<string>>(new Set());

    // Effect to trigger onDataUpdate when tool results indicate changes
    useEffect(() => {
        if (!onDataUpdate) return;

        if (status === 'streaming') return;

        // Get the latest message
        const lastMessage = messages[messages.length - 1];
        if (!lastMessage || lastMessage.role !== 'assistant') return;

        // Skip if we've already processed this message
        if (processedMessageIdsRef.current.has(lastMessage.id)) return;

        const toolResults = getToolResults(lastMessage);

        // Only process if there are actual tool results
        if (toolResults.length === 0) return;

        // Mark as processed before calling callback
        processedMessageIdsRef.current.add(lastMessage.id);

        toolResults.forEach(({ toolName, result }) => {
            console.log('[AICopilot] Processing tool result:', toolName, result);
            if (result?.success) {
                if (toolName === 'update_cell_value' && result.rowNumber && result.field) {
                    const updateEvent: DataUpdateEvent = {
                        type: 'update_cell',
                        rowNumber: result.rowNumber,
                        field: result.field,
                        newValue: result.newValue,
                    };
                    console.log(`[AICopilot] Calling onDataUpdate for update_cell:`, updateEvent);
                    onDataUpdate(updateEvent);
                } else if (toolName === 'fix_missing_quantities' && result.affectedRows) {
                    onDataUpdate({
                        type: 'fix_quantities',
                        affectedRows: result.affectedRows,
                        defaultQuantity: 1, // Default value used
                    });
                } else if (toolName === 'delete_rows' && result.rowNumbers) {
                    onDataUpdate({
                        type: 'delete_rows',
                        rowNumbers: result.rowNumbers,
                    });
                } else if (toolName === 'clear_column' && result.field) {
                    onDataUpdate({
                        type: 'clear_column',
                        field: result.field,
                    });
                }
            }
        });
    }, [messages, status, onDataUpdate]);

    // Render tool result UI
    const renderToolResult = (toolResult: ToolResult) => {
        const { toolName, result } = toolResult;

        if (toolName === 'generate_corrected_download' && result?.downloadUrl) {
            return (
                <div key={toolName} className="tool-result download-result">
                    <div className="tool-result-header">
                        <span className="tool-icon">✅</span>
                        <span>File Ready for Download</span>
                    </div>
                    <p className="tool-result-message">{result.message}</p>
                    <a
                        href={result.downloadUrl}
                        download={result.fileName}
                        className="download-button"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                            <polyline points="7,10 12,15 17,10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download {result.fileName}
                    </a>
                </div>
            );
        }

        if (toolName === 'fix_missing_quantities' && result?.success) {
            return (
                <div key={toolName} className="tool-result fix-result">
                    <div className="tool-result-header">
                        <span className="tool-icon">🔧</span>
                        <span>Fixes Applied</span>
                    </div>
                    <p className="tool-result-message">
                        Fixed {result.fixedCount} rows with missing quantities.
                        {result.affectedRows && result.affectedRows.length > 0 && (
                            <span className="affected-rows"> (Rows: {result.affectedRows.slice(0, 5).join(', ')}{result.affectedRows.length > 5 ? '...' : ''})</span>
                        )}
                    </p>
                    {result.downloadUrl && (
                        <a
                            href={result.downloadUrl}
                            download={result.fileName}
                            className="download-button"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                <polyline points="7,10 12,15 17,10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Download {result.fileName}
                        </a>
                    )}
                </div>
            );
        }

        if (toolName === 'update_cell_value' && result?.success) {
            return (
                <div key={`${toolName}-${result.rowNumber}`} className="tool-result fix-result">
                    <div className="tool-result-header">
                        <span className="tool-icon">✏️</span>
                        <span>Cell Updated</span>
                    </div>
                    <p className="tool-result-message">
                        {result.message}
                    </p>
                    {result.downloadUrl && (
                        <a
                            href={result.downloadUrl}
                            download={result.fileName}
                            className="download-button"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                <polyline points="7,10 12,15 17,10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Download {result.fileName}
                        </a>
                    )}
                </div>
            );
        }

        if (toolName === 'delete_rows' && result?.success) {
            return (
                <div key={toolName} className="tool-result fix-result">
                    <div className="tool-result-header">
                        <span className="tool-icon">🗑️</span>
                        <span>Rows Deleted</span>
                    </div>
                    <p className="tool-result-message">
                        {result.message}
                    </p>
                    {result.downloadUrl && (
                        <a
                            href={result.downloadUrl}
                            download={result.fileName}
                            className="download-button"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                <polyline points="7,10 12,15 17,10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Download {result.fileName}
                        </a>
                    )}
                </div>
            );
        }

        if (toolName === 'clear_column' && result?.success) {
            return (
                <div key={toolName} className="tool-result fix-result">
                    <div className="tool-result-header">
                        <span className="tool-icon">🧹</span>
                        <span>Column Cleared</span>
                    </div>
                    <p className="tool-result-message">
                        {result.message}
                    </p>
                    {result.downloadUrl && (
                        <a
                            href={result.downloadUrl}
                            download={result.fileName}
                            className="download-button"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                <polyline points="7,10 12,15 17,10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Download {result.fileName}
                        </a>
                    )}
                </div>
            );
        }

        return null;
    };

    return (
        <div className="ai-copilot">
            {/* Header */}
            <div className="ai-header">
                <div className="ai-header-info">
                    <div className="ai-avatar">🤖</div>
                    <div>
                        <h2>Quote Copilot AI</h2>
                        <span className="ai-status">
                            {isLoading ? 'Thinking...' : analysis ? 'Ready to analyze' : 'Waiting for file'}
                        </span>
                    </div>
                </div>
                <div className="ai-indicator">
                    <span className={`status-dot ${analysis ? 'active' : 'idle'}`}></span>
                </div>
            </div>

            {/* Messages Area */}
            <div className="ai-messages">
                {displayMessages.length === 0 && (
                    <div className="ai-welcome">
                        <div className="welcome-graphic">
                            <div className="welcome-icon-large">🧠</div>
                            <div className="welcome-glow"></div>
                        </div>
                        <h3>Your AI Sales Engineering Assistant</h3>
                        <p>
                            {analysis
                                ? "I've analyzed your file. Ask me about risks, negotiation strategies, or data insights."
                                : "Upload an Excel BOM to get started. I'll analyze columns, detect risks, and help you build better quotes."}
                        </p>

                        <div className="ai-capabilities">
                            <div className="capability">
                                <span className="capability-icon">🎯</span>
                                <span>Risk Analysis</span>
                            </div>
                            <div className="capability">
                                <span className="capability-icon">💡</span>
                                <span>Negotiation Tips</span>
                            </div>
                            <div className="capability">
                                <span className="capability-icon">🔧</span>
                                <span>Data Fixes</span>
                            </div>
                            <div className="capability">
                                <span className="capability-icon">📥</span>
                                <span>Downloads</span>
                            </div>
                        </div>

                        <div className="suggested-questions">
                            <p className="suggestions-label">Try asking:</p>
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
                        className={`ai-message ${message.role === 'user' ? 'user' : 'assistant'}`}
                    >
                        <div className="message-avatar">
                            {message.role === 'user' ? '👤' : '🤖'}
                        </div>
                        <div className="message-content">
                            {message.text && <div className="message-text">{message.text}</div>}
                            {message.toolResults.length > 0 && (
                                <div className="tool-results">
                                    {message.toolResults.map(renderToolResult)}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="ai-message assistant">
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
                    <div className="ai-error">
                        <span>⚠️ {error.message || 'Failed to send message'}</span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form className="ai-input-form" onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={analysis ? "Ask about your quote..." : "Ask me anything..."}
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
    );
}
