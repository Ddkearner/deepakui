import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, CheckIcon, SearchIcon } from './Icons';

interface Model {
    id: string;
    name: string;
    provider: 'google' | 'openrouter';
    modelId: string;
}

interface StudioModelSelectorProps {
    models: Model[];
    selectedModel: Model;
    onSelect: (model: Model) => void;
    disabled?: boolean;
}

export default function StudioModelSelector({ models, selectedModel, onSelect, disabled }: StudioModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Clean up model names for display
    const getDisplayName = (originalName: string) => {
        let name = originalName.replace(/\(free\)/gi, '').trim();
        name = name.replace(/Free$/i, '').trim();
        name = name.replace(/PAID$/i, '').trim();
        name = name.replace(/⚡$/, '').trim();
        return name;
    };

    const isPaid = (name: string) => name.toUpperCase().includes('PAID');

    // Filter models
    const filteredModels = models.filter(m =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getProviderBadge = (model: Model) => {
        if (model.provider === 'google') return <span className="sms-badge google">Google</span>;
        const lower = model.modelId.toLowerCase();
        if (lower.includes('mistral')) return <span className="sms-badge mistral">Mistral</span>;
        if (lower.includes('meta') || lower.includes('llama')) return <span className="sms-badge meta">Meta</span>;
        if (lower.includes('qwen')) return <span className="sms-badge qwen">Qwen</span>;
        if (lower.includes('deepseek')) return <span className="sms-badge deepseek">DeepSeek</span>;
        return <span className="sms-badge other">OpenRouter</span>;
    };

    return (
        <div className="sms-container" ref={dropdownRef}>
            <button
                type="button"
                className={`sms-trigger ${isOpen ? 'active' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                title={selectedModel.name}
            >
                <div className="sms-info">
                    <span className="sms-name-text">
                        {getDisplayName(selectedModel.name)}
                    </span>
                    {isPaid(selectedModel.name) ? (
                        <span className="sms-tag paid">PAID</span>
                    ) : (
                        <span className="sms-tag free">FREE</span>
                    )}
                </div>
                <ChevronDownIcon />
            </button>

            {isOpen && (
                <div className="sms-dropdown">
                    <div className="sms-search">
                        <SearchIcon />
                        <input
                            type="text"
                            placeholder="Search models..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>

                    <div className="sms-list">
                        {filteredModels.length > 0 ? (
                            filteredModels.map(model => (
                                <button
                                    key={model.id}
                                    className={`sms-option ${selectedModel.id === model.id ? 'selected' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelect(model);
                                        setIsOpen(false);
                                        setSearchQuery('');
                                    }}
                                >
                                    <div className="sms-option-content">
                                        <div className="sms-option-name">
                                            {getDisplayName(model.name)}
                                        </div>
                                        <div className="sms-option-meta">
                                            {getProviderBadge(model)}
                                        </div>
                                    </div>
                                    {selectedModel.id === model.id && <CheckIcon />}
                                </button>
                            ))
                        ) : (
                            <div className="sms-no-results">No models found</div>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                .sms-container {
                    position: relative;
                    width: auto;
                    min-width: 140px;
                    max-width: 240px;
                    display: block;
                }

                .sms-trigger {
                    width: 100% !important;
                    height: 36px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    background: transparent !important;
                    border: 1px solid transparent !important;
                    color: var(--text-secondary) !important;
                    padding: 0 8px !important;
                    border-radius: 8px !important;
                    cursor: pointer;
                    font-size: 0.85rem !important;
                    gap: 8px;
                    white-space: nowrap;
                    overflow: hidden;
                }

                .sms-trigger:hover:not(:disabled) {
                    background: rgba(255, 255, 255, 0.05) !important;
                    color: var(--text-primary) !important;
                }

                .sms-trigger.active {
                    background: var(--accent-bg) !important;
                    color: var(--text-primary) !important;
                }

                .sms-info {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    overflow: hidden;
                    flex: 1;
                }

                .sms-name-text {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    font-weight: 500;
                }

                .sms-tag {
                    font-size: 0.6rem;
                    padding: 2px 4px;
                    border-radius: 4px;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    flex-shrink: 0;
                }
                .sms-tag.free { background: rgba(16, 185, 129, 0.15); color: #10b981; }
                .sms-tag.paid { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

                .sms-dropdown {
                    position: absolute;
                    bottom: 100%;
                    left: 0;
                    margin-bottom: 8px;
                    width: 300px;
                    background: var(--card-bg) !important;
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    animation: smsSlideUp 0.15s ease-out;
                    padding: 0 !important;
                }

                @keyframes smsSlideUp {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .sms-search {
                    padding: 10px;
                    border-bottom: 1px solid var(--border-color);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--text-secondary);
                    background: var(--input-bg);
                }

                .sms-search input {
                    background: transparent;
                    border: none;
                    color: var(--text-primary);
                    width: 100%;
                    outline: none;
                    font-size: 0.9rem;
                    padding: 0;
                    height: auto;
                }

                .sms-list {
                    max-height: 320px;
                    overflow-y: auto;
                    padding: 6px;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .sms-list::-webkit-scrollbar { width: 5px; }
                .sms-list::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }

                .sms-option {
                    width: 100% !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    padding: 8px 12px !important;
                    background: transparent !important;
                    border: none !important;
                    color: var(--text-secondary) !important;
                    cursor: pointer;
                    border-radius: 8px !important;
                    text-align: left;
                    font-size: 0.9rem !important;
                    height: auto !important;
                    min-height: 48px;
                }

                .sms-option:hover {
                    background: var(--accent-bg) !important;
                    color: var(--text-primary) !important;
                }

                .sms-option.selected {
                    background: var(--accent-bg) !important;
                    color: var(--text-primary) !important;
                    border: 1px solid var(--border-color) !important;
                }

                .sms-option-content {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    overflow: hidden;
                    flex: 1;
                }

                .sms-option-name {
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .sms-option-meta {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .sms-badge {
                    font-size: 0.65rem;
                    padding: 1px 6px;
                    border-radius: 4px;
                    display: inline-block;
                    line-height: 1.4;
                    font-weight: 500;
                }
                .sms-badge.google { color: #ea4335; background: rgba(234, 67, 53, 0.1); border: 1px solid rgba(234, 67, 53, 0.2); }
                .sms-badge.mistral { color: #f59e0b; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); }
                .sms-badge.meta { color: #0668E1; background: rgba(6, 104, 225, 0.1); border: 1px solid rgba(6, 104, 225, 0.2); }
                .sms-badge.qwen { color: #8b5cf6; background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.2); }
                .sms-badge.deepseek { color: #3b82f6; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); }
                .sms-badge.other { color: var(--text-secondary); background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); }

                .sms-no-results {
                    padding: 16px;
                    text-align: center;
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                }
            `}</style>
        </div>
    );
}
