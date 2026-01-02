import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, CheckIcon, SearchIcon, SparklesIcon } from './Icons';

interface Model {
    id: string;
    name: string;
    provider: 'google' | 'openrouter';
    modelId: string;
}

interface ModelSelectorProps {
    models: Model[];
    selectedModel: Model;
    onSelect: (model: Model) => void;
    disabled?: boolean;
}

export default function ModelSelector({ models, selectedModel, onSelect, disabled }: ModelSelectorProps) {
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
        // Remove redundant "(Free)" or "(free)"
        let name = originalName.replace(/\(free\)/gi, '').trim();
        // Remove "Free" or "PAID" if it's at the end
        name = name.replace(/Free$/i, '').trim();
        name = name.replace(/PAID$/i, '').trim();
        // Remove trailing icons/space
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
        if (model.provider === 'google') return <span className="provider-badge google">Google</span>;

        // Try to guess from ID/Name
        const lower = model.modelId.toLowerCase();
        if (lower.includes('mistral')) return <span className="provider-badge mistral">Mistral</span>;
        if (lower.includes('meta') || lower.includes('llama')) return <span className="provider-badge meta">Meta</span>;
        if (lower.includes('qwen')) return <span className="provider-badge qwen">Qwen</span>;
        if (lower.includes('deepseek')) return <span className="provider-badge deepseek">DeepSeek</span>;
        if (lower.includes('microsoft') || lower.includes('wizard')) return <span className="provider-badge microsoft">Microsoft</span>;

        return <span className="provider-badge other">OpenRouter</span>;
    };

    return (
        <div className="custom-model-selector" ref={dropdownRef}>
            <button
                type="button"
                className={`model-trigger-btn ${isOpen ? 'active' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
            >
                <div className="current-model-info">
                    <div className="model-name-display">
                        {getDisplayName(selectedModel.name)}
                        {isPaid(selectedModel.name) ? (
                            <span className="paid-tag">Paid</span>
                        ) : (
                            <span className="free-tag">Free</span>
                        )}
                    </div>
                </div>
                <ChevronDownIcon />
            </button>

            {isOpen && (
                <div className="model-dropdown-menu">
                    <div className="model-search-wrapper">
                        <SearchIcon />
                        <input
                            type="text"
                            placeholder="Search models..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="model-list">
                        {filteredModels.length > 0 ? (
                            filteredModels.map(model => (
                                <button
                                    key={model.id}
                                    className={`model-option ${selectedModel.id === model.id ? 'selected' : ''}`}
                                    onClick={() => {
                                        onSelect(model);
                                        setIsOpen(false);
                                        setSearchQuery('');
                                    }}
                                >
                                    <div className="model-option-content">
                                        <div className="model-option-name">
                                            {getDisplayName(model.name)}
                                        </div>
                                        <div className="model-option-meta">
                                            {getProviderBadge(model)}
                                            <span className="model-id-tiny">{model.modelId.split('/')[1] || model.modelId}</span>
                                        </div>
                                    </div>
                                    {selectedModel.id === model.id && <CheckIcon />}
                                </button>
                            ))
                        ) : (
                            <div className="no-models-found">
                                No models found
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                .custom-model-selector {
                    position: relative;
                    min-width: 240px;
                }

                .model-trigger-btn {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: var(--input-bg);
                    border: 1px solid var(--border-color);
                    color: var(--text-primary);
                    padding: 8px 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 0.9rem;
                    text-align: left;
                }

                .model-trigger-btn:hover:not(:disabled) {
                    background: var(--accent-bg);
                    border-color: var(--text-secondary);
                }

                .model-trigger-btn.active {
                    border-color: var(--text-primary);
                    background: var(--accent-bg);
                }
                
                .model-trigger-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .model-name-display {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 500;
                }

                .paid-tag {
                    font-size: 0.65rem;
                    padding: 2px 6px;
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                    border-radius: 99px;
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    text-transform: uppercase;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                }

                .free-tag {
                    font-size: 0.65rem;
                    padding: 2px 6px;
                    background: rgba(16, 185, 129, 0.1);
                    color: #10b981;
                    border-radius: 99px;
                    border: 1px solid rgba(16, 185, 129, 0.2);
                    text-transform: uppercase;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                }

                .model-dropdown-menu {
                    position: absolute;
                    bottom: 110%; /* Open upwards by default as it's at the bottom */
                    left: 0;
                    width: 320px;
                    max-height: 400px;
                    background: var(--card-bg); /* Use solid card bg to avoid transparency issues with text */
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                    z-index: 1000;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    animation: slideUpFade 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                }

                @keyframes slideUpFade {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .model-search-wrapper {
                    padding: 12px;
                    border-bottom: 1px solid var(--border-color);
                    position: relative;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--text-secondary);
                }

                .model-search-wrapper input {
                    background: transparent;
                    border: none;
                    color: var(--text-primary);
                    width: 100%;
                    outline: none;
                    font-size: 0.9rem;
                }

                .model-list {
                    overflow-y: auto;
                    max-height: 350px;
                    padding: 6px;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                
                /* Custom Scrollbar */
                .model-list::-webkit-scrollbar {
                    width: 6px;
                }
                .model-list::-webkit-scrollbar-thumb {
                    background: var(--border-color);
                    border-radius: 3px;
                }

                .model-option {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 12px;
                    background: transparent;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    border-radius: 8px;
                    transition: all 0.15s;
                    text-align: left;
                }

                .model-option:hover {
                    background: var(--accent-bg);
                    color: var(--text-primary);
                }

                .model-option.selected {
                    background: var(--accent-bg);
                    color: var(--text-primary);
                    border: 1px solid var(--border-color);
                }

                .model-option-content {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .model-option-name {
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .model-option-meta {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .provider-badge {
                    font-size: 0.65rem;
                    padding: 2px 6px;
                    border-radius: 4px;
                    background: var(--input-bg);
                    border: 1px solid var(--border-color);
                }
                
                .provider-badge.google { color: #ea4335; border-color: rgba(234, 67, 53, 0.3); background: rgba(234, 67, 53, 0.1); }
                .provider-badge.mistral { color: #f59e0b; border-color: rgba(245, 158, 11, 0.3); background: rgba(245, 158, 11, 0.1); }
                .provider-badge.meta { color: #0668E1; border-color: rgba(6, 104, 225, 0.3); background: rgba(6, 104, 225, 0.1); }
                .provider-badge.qwen { color: #8b5cf6; border-color: rgba(139, 92, 246, 0.3); background: rgba(139, 92, 246, 0.1); }
                .provider-badge.deepseek { color: #3b82f6; border-color: rgba(59, 130, 246, 0.3); background: rgba(59, 130, 246, 0.1); }
                
                .model-id-tiny {
                    font-size: 0.7rem;
                    opacity: 0.5;
                    font-family: monospace;
                }

                .no-models-found {
                    padding: 20px;
                    text-align: center;
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                }
            `}</style>
        </div>
    );
}
