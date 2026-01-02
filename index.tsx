/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Vibe coded by Deepak Yadav

import { GoogleGenAI } from '@google/genai';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

import { Artifact, Session, ComponentVariation, StudioPage, SavedProject } from './types';
import { INITIAL_PLACEHOLDERS } from './constants';
import { generateId } from './utils';
import JSZip from 'jszip';

const MARKETPLACES = [
    { name: 'Framer', url: 'https://www.framer.com/marketplace/templates/' },
    { name: 'Envato Elements', url: 'https://elements.envato.com/web-templates?msockid=1655d9174ecd6f621b69cfdb4faf6eb4' },
    { name: 'Webflow', url: 'https://webflow.com/templates?msockid=1655d9174ecd6f621b69cfdb4faf6eb4' },
    { name: 'Template Monster', url: 'https://www.templatemonster.com/premium-html-website-templates/' },
    { name: 'React Templates', url: 'https://www.reacttemplates.dev/popular/premium/' },
    { name: 'Template Goat', url: 'https://templategoat.com/' }
];

export interface Model {
    id: string;
    name: string;
    provider: 'google' | 'openrouter';
    modelId: string;
}

// OpenRouter API Response Types
interface OpenRouterModel {
    id: string;
    name: string;
    pricing: {
        prompt: string;
        completion: string;
    };
    context_length: number;
}

interface OpenRouterModelsResponse {
    data: OpenRouterModel[];
}

// Static models (always available)
const STATIC_MODELS: Model[] = [
    // Google Gemini (FREE with your API key)
    { id: 'gemini-flash', name: 'Gemini Flash ⚡ PAID', provider: 'google', modelId: 'gemini-3-flash-preview' }
];

// Fallback OpenRouter models (prioritize free coding models)
// These are reliable coding-focused models that shouldn't hit rate limits
const FALLBACK_OPENROUTER_MODELS: Model[] = [
    { id: 'mistral-devstral-2', name: 'Mistral: Devstral 2 2512 (Free)', provider: 'openrouter', modelId: 'mistralai/mistral-devstral-2:free' },
    { id: 'qwen-coder-480b', name: 'Qwen: Qwen3 Coder 480B A35B (Free)', provider: 'openrouter', modelId: 'qwen/qwen-3-coder-480b-a35b:free' },
    { id: 'kat-coder-pro', name: 'Kwaipilot: KAT-Coder-Pro V1 (Free)', provider: 'openrouter', modelId: 'kwaipilot/kat-coder-pro-v1:free' },
    { id: 'deepseek-v3-nex', name: 'Nex AGI: DeepSeek V3.1 Nex N1 (Free)', provider: 'openrouter', modelId: 'nex-agi/deepseek-v3.1-nex-n1:free' },
    { id: 'xiaomi-mimo-flash', name: 'Xiaomi: MiMo-V2-Flash (Free)', provider: 'openrouter', modelId: 'xiaomi/mimo-v2-flash:free' }
];


// Fetch available free CODING models from OpenRouter
async function fetchOpenRouterModels(): Promise<Model[]> {
    try {
        console.log('🔌 Fetching OpenRouter coding models...');

        // Check cache first (24 hour expiry)
        const cached = localStorage.getItem('openrouter_models_cache_v2');
        const cacheTimestamp = localStorage.getItem('openrouter_models_timestamp_v2');

        if (cached && cacheTimestamp) {
            const age = Date.now() - parseInt(cacheTimestamp);
            const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

            if (age < CACHE_DURATION) {
                console.log('✅ Using cached OpenRouter models');
                return JSON.parse(cached);
            }
        }

        // Fetch from OpenRouter API
        const response = await fetch('https://openrouter.ai/api/v1/models');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: OpenRouterModelsResponse = await response.json();

        // CODING KEYWORDS: Models with these keywords are coding-focused
        const codingKeywords = [
            'coder', 'code', 'dev', 'deepseek', 'qwen', 'mistral',
            'devstral', 'kwaipilot', 'kat-coder', 'mimo', 'llama',
            'nemotron', 'chimera', 'research', 'deepresearch'
        ];

        // BLACKLIST: Defected models to exclude
        const blacklistedModels = [
            'Olmo 3.1 32B Think', 'DeepSeek V3.1 Nex N1', 'Trinity Mini',
            'R1T Chimera', 'Olmo 3 32B Think', 'Nemotron Nano 12B 2 VL',
            'Tongyi DeepResearch 30B A3B', 'Nemotron Nano 9B V2', 'gpt-oss-120b',
            'gpt-oss-20b', 'GLM 4.5 Air', 'Qwen3 Coder 480B A35B',
            'Kimi K2 0711', 'Venice: Uncensored', 'Gemma 3n 2B',
            'DeepSeek R1T2 Chimera', 'R1 0528', 'Gemma 3n 4B', 'Qwen3 4B',
            'Mistral Small 3.1 24B', 'Gemma 3 4B', 'Gemma 3 12B',
            'Gemma 3 27B', 'Llama 3.3 70B Instruct', 'Llama 3.2 3B Instruct',
            'Qwen2.5-VL 7B Instruct', 'Hermes 3 405B Instruct',
            'Llama 3.1 405B Instruct', 'Mistral 7B Instruct'
        ];

        // Filter for truly free models (pricing = "0" for both prompt and completion)
        // AND filter for coding-focused models using keywords
        // AND exclude blacklisted models
        const freeModels = data.data.filter(m => {
            const isFree = m.pricing.prompt === "0" && m.pricing.completion === "0";

            const isCodingModel = codingKeywords.some(keyword =>
                m.id.toLowerCase().includes(keyword) ||
                m.name.toLowerCase().includes(keyword)
            );

            const isBlacklisted = blacklistedModels.some(bad =>
                m.name.includes(bad) || m.id.includes(bad)
            );

            return isFree && isCodingModel && !isBlacklisted;
        });

        console.log(`✅ Found ${freeModels.length} free coding models from OpenRouter (after blacklist)`);

        // Map to internal Model format
        const models: Model[] = freeModels.map(m => ({
            id: m.id.replace(/[/:]/g, '-'), // sanitize ID for use as HTML id
            name: `${m.name} (Free)`,
            provider: 'openrouter',
            modelId: m.id
        }));

        // Cache the results
        localStorage.setItem('openrouter_models_cache_v2', JSON.stringify(models));
        localStorage.setItem('openrouter_models_timestamp_v2', Date.now().toString());

        return models;

    } catch (error) {
        console.error('❌ Failed to fetch OpenRouter models:', error);
        console.log('⚠️ Using fallback coding models');
        return FALLBACK_OPENROUTER_MODELS;
    }
}


async function* streamAI({
    model,
    apiKey,
    systemInstruction,
    prompt,
    images = []
}: {
    model: Model,
    apiKey: string,
    systemInstruction?: string,
    prompt: string,
    images?: string[]
}) {
    if (model.provider === 'google') {
        const ai = new GoogleGenAI({ apiKey });
        const parts: any[] = [];
        if (systemInstruction) {
            parts.push({ text: systemInstruction });
        }
        parts.push({ text: prompt });

        images.forEach(img => {
            const base64Data = img.split(',')[1];
            parts.push({ inlineData: { data: base64Data, mimeType: 'image/png' } });
        });

        const result = await ai.models.generateContentStream({
            model: model.modelId,
            contents: [{ role: 'user', parts }]
        });

        for await (const chunk of result) {
            yield chunk.text;
        }
    } else {
        // OpenRouter API
        const messages: any[] = [];
        if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });

        const content: any[] = [{ type: 'text', text: prompt }];
        images.forEach(img => {
            content.push({ type: 'image_url', image_url: { url: img } });
        });
        messages.push({ role: 'user', content });

        console.log('🔌 OpenRouter API Request:', { model: model.modelId, messageCount: messages.length });

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://deepak-ui.com',
                'X-Title': 'Deepak UI'
            },
            body: JSON.stringify({
                model: model.modelId,
                messages,
                stream: true
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('🔴 OpenRouter API Error:', response.status, errorText);
            throw new Error(`OpenRouter API failed: ${response.status} - ${errorText}`);
        }

        if (!response.body) throw new Error("No response body");

        console.log('✅ OpenRouter streaming started');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                        const json = JSON.parse(line.substring(6));
                        const text = json.choices[0]?.delta?.content || '';
                        if (text) yield text;
                    } catch (e) {
                        console.warn('Failed to parse SSE line:', line);
                    }
                }
            }
        }
        console.log('✅ OpenRouter streaming complete');
    }
}

import DottedGlowBackground from './components/DottedGlowBackground';
import ModelSelector from './components/ModelSelector';
import StudioModelSelector from './components/StudioModelSelector';
import ArtifactCard from './components/ArtifactCard';
import SideDrawer from './components/SideDrawer';
import PasteUrlModal from './components/PasteUrlModal';
import ProgressSteps, { ProgressStep, StepStatus } from './components/ProgressSteps';
import {
    ThinkingIcon,
    CodeIcon,
    SparklesIcon,
    ArrowLeftIcon,
    ArrowRightIcon,
    ArrowUpIcon,
    GridIcon,
    SunIcon,
    MoonIcon,
    TerminalIcon,
    LayersIcon,
    SettingsIcon,
    DownloadIcon,
    PaperclipIcon,
    ImageIcon,
    LinkIcon,
    XIcon,
    PlusIcon,
    MonitorIcon,
    TabletIcon,
    SmartphoneIcon,
    RefreshIcon,
    MaximizeIcon,
    MinimizeIcon,
    MenuIcon,
    TrashIcon,
    PaletteIcon
} from './components/Icons';

// Recursive Menu Item Component
const RecursiveMenuItem: React.FC<{
    layer: LayerInfo,
    onSelect: (s: string) => void,
    onHover: (s: string | null) => void
}> = ({
    layer,
    onSelect,
    onHover
}) => {
        return (
            <div
                className={`context-menu-item ${layer.children && layer.children.length > 0 ? 'relative-parent' : ''}`}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(layer.selector);
                }}
                onMouseEnter={() => onHover(layer.selector)}
            >
                <span className="layer-tag">{layer.tagName.toLowerCase()}</span>
                <span className="layer-label">{layer.label}</span>

                {layer.children && layer.children.length > 0 && (
                    <div className="submenu recursive-child">
                        {layer.children.map((child, i) => (
                            <RecursiveMenuItem
                                key={i}
                                layer={child}
                                onSelect={onSelect}
                                onHover={onHover}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    };

interface LayerInfo {
    tagName: string;
    className: string;
    id: string;
    selector: string;
    label: string;
    children?: LayerInfo[];
}

function App() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentSessionIndex, setCurrentSessionIndex] = useState<number>(-1);
    const [focusedArtifactIndex, setFocusedArtifactIndex] = useState<number | null>(null);

    const [inputValue, setInputValue] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isEnhancingMain, setIsEnhancingMain] = useState<boolean>(false);
    const [isEnhancingStudio, setIsEnhancingStudio] = useState<boolean>(false);
    const [enhanceError, setEnhanceError] = useState<string | null>(null);
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [placeholders, setPlaceholders] = useState<string[]>(INITIAL_PLACEHOLDERS);

    const [theme, setTheme] = useState<'dark' | 'light'>(() => {
        return (localStorage.getItem('app-theme') as 'dark' | 'light') || 'dark';
    });

    const [studioPages, setStudioPages] = useState<StudioPage[]>([]);
    const [activePageId, setActivePageId] = useState<string | null>(null);
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

    // Theme Editor States
    const [showThemeEditor, setShowThemeEditor] = useState(false);
    const [isGlobalThemeEdit, setIsGlobalThemeEdit] = useState(false);
    const [themeColors, setThemeColors] = useState<string[]>([]);
    const [editingColor, setEditingColor] = useState<string | null>(null);

    // Dynamic OpenRouter Models
    const [openRouterModels, setOpenRouterModels] = useState<Model[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(true);
    const [modelsError, setModelsError] = useState<string | null>(null);

    // Combined models list
    const MODELS = [...STATIC_MODELS, ...openRouterModels];

    const [selectedModel, setSelectedModel] = useState<Model>(STATIC_MODELS[0]); // Default to Gemini Flash

    // Fetch OpenRouter models on mount
    useEffect(() => {
        const loadModels = async () => {
            setIsLoadingModels(true);
            try {
                const models = await fetchOpenRouterModels();
                setOpenRouterModels(models);
                setModelsError(null);

                // Set Default Model: NVIDIA Nemotron 3 Nano 30B
                const defaultModel = models.find(m => m.name.includes('Nemotron 3 Nano 30B'));
                if (defaultModel) {
                    setSelectedModel(defaultModel);
                }
            } catch (error) {
                console.error('Error loading models:', error);
                setModelsError('Failed to load models');
            } finally {
                setIsLoadingModels(false);
            }
        };
        loadModels();
    }, []);

    // Debug: Check API keys on mount
    useEffect(() => {
        const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
        const openrouterKey = import.meta.env.VITE_OPENROUTER_API_KEY;

        console.log('🔑 API Keys Status:');
        console.log('  Gemini:', geminiKey ? `✅ Configured (${geminiKey.substring(0, 10)}...)` : '❌ Not configured');
        console.log('  OpenRouter:', openrouterKey ? `✅ Configured (${openrouterKey.substring(0, 10)}...)` : '❌ Not configured');
    }, []);



    // Auto-Save Effect
    useEffect(() => {
        if (!activeProjectId || studioPages.length === 0) return;

        const saveProject = () => {
            try {
                // Determine Project Name
                let projectName = 'Untitled Project';
                const firstPage = studioPages[0];
                if (firstPage) {
                    // Prioritize explicit names (like from manual entry)
                    if (firstPage.name && firstPage.name !== 'index.html') {
                        projectName = firstPage.name;
                    }
                    // Then fallback to style names or defaults
                    else if (firstPage.artifact?.styleName && firstPage.artifact.styleName !== 'Blank Canvas') {
                        projectName = firstPage.artifact.styleName;
                    }
                    else if (firstPage.name === 'index.html' && sessions.length > 0 && sessions[currentSessionIndex]?.prompt) {
                        projectName = sessions[currentSessionIndex].prompt.substring(0, 30) + '...';
                    }

                    // Smart Naming for Imports: Only search title if we have real content
                    if (firstPage.artifact?.styleName === 'Imported Site' && firstPage.artifact.status === 'complete') {
                        const match = firstPage.artifact.html.match(/<title>(.*?)<\/title>/i);
                        if (match && match[1]) projectName = match[1];
                        else projectName = 'Imported Project';
                    }
                }

                const projectData: SavedProject = {
                    id: activeProjectId,
                    name: projectName,
                    pages: studioPages,
                    lastModified: Date.now(),
                    previewHtml: studioPages[0]?.artifact?.html || ''
                };

                // CRITICAL: Avoid saving the "Initializing" placeholder as the permanent preview
                const isPlaceholder = projectData.previewHtml.includes('Initializing Scraper...');

                // Try to save individual project data
                try {
                    localStorage.setItem(`deepak_ui_project_${activeProjectId}`, JSON.stringify(projectData));
                } catch (e) {
                    console.error("💾 Project too large for LocalStorage.", e);
                }
            } catch (e) {
                console.error("💥 Auto-save failed:", e);
            }
        };

        const timeoutId = setTimeout(saveProject, 1000); // Debounce save
        return () => clearTimeout(timeoutId);
    }, [studioPages, activeProjectId]);

    const handleLoadProject = (projectId: string) => {
        console.log("🚀 Loading project:", projectId);
        try {
            const raw = localStorage.getItem(`deepak_ui_project_${projectId}`);
            if (raw) {
                const data: SavedProject = JSON.parse(raw);
                if (data.pages && data.pages.length > 0) {
                    // ATOMIC UPDATE: No intermediate blank state
                    // This prevents unmounting and flickering
                    setStudioPages(data.pages);
                    setActivePageId(data.pages[0].id);
                    setActiveProjectId(data.id);

                    // Explicitly sync HTML immediately to avoid iframe blankness
                    setLastSyncedHtml(data.pages[0].artifact?.html || '');

                    // Reset internal states
                    setIsCodeView(false);
                    setIsMagicEditActive(false);
                    setFocusedArtifactIndex(null);

                    console.log("✅ Project data loaded successfully");
                }
            }
        } catch (e) {
            console.error("💥 Load failed:", e);
        }
    };

    // Safe derivation of active page with fallback to ensure Studio always opens if pages exist
    const activePage = studioPages.find(p => p.id === activePageId) || (studioPages.length > 0 ? studioPages[0] : undefined);
    const studioArtifact = activePage?.artifact || null;
    const studioChat = activePage?.chat || [];

    // Helper to set studio artifact (backward compatibility wrapper)
    const setStudioArtifact = (action: React.SetStateAction<Artifact | null>) => {
        setStudioPages(prev => {
            const currentActive = prev.find(p => p.id === activePageId);
            if (!currentActive) return prev;

            let nextArtifact: Artifact | null = null;
            if (typeof action === 'function') {
                nextArtifact = action(currentActive.artifact);
            } else {
                nextArtifact = action;
            }

            if (!nextArtifact) return prev;

            return prev.map(p => p.id === activePageId ? { ...p, artifact: nextArtifact! } : p);
        });
    };

    // Helper to set studio chat
    const setStudioChat = (action: React.SetStateAction<{ role: 'user' | 'model', text: string }[]>) => {
        setStudioPages(prev => {
            const currentActive = prev.find(p => p.id === activePageId);
            if (!currentActive) return prev;

            let newChat: { role: 'user' | 'model', text: string }[] = [];
            if (typeof action === 'function') {
                newChat = action(currentActive.chat);
            } else {
                newChat = action;
            }

            return prev.map(p => p.id === activePageId ? { ...p, chat: newChat } : p);
        });
    };



    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{
        visible: boolean;
        x: number;
        y: number;
        selector: string;
        currentHref: string | null;
        tagName?: string;
        layers?: LayerInfo[];       // For flat list (fallback) or now used for "Parent Stack"
        parents?: LayerInfo[];      // Ancestors
        children?: LayerInfo[];     // Children (recursive tree)
        elementColors?: {           // Computed colors for the selected element
            text: string;
            background: string;
            border: string;
        };
    }>({ visible: false, x: 0, y: 0, selector: '', currentHref: null, tagName: undefined });

    const [editingProperty, setEditingProperty] = useState<string | null>(null);

    const [studioInputValue, setStudioInputValue] = useState('');
    const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);

    // Studio Attachment State
    const [studioImages, setStudioImages] = useState<string[]>([]);
    const [studioUrl, setStudioUrl] = useState<string | null>(null);
    const studioFileInputRef = useRef<HTMLInputElement>(null);
    const replaceImageInputRef = useRef<HTMLInputElement>(null);

    // Advanced Input State
    const [inputImages, setInputImages] = useState<string[]>([]);
    const [inputUrl, setInputUrl] = useState<string | null>(null);
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [drawerState, setDrawerState] = useState<{
        isOpen: boolean;
        mode: 'code' | 'variations' | null;
        title: string;
        data: any;
    }>({ isOpen: false, mode: null, title: '', data: null });

    const [componentVariations, setComponentVariations] = useState<ComponentVariation[]>([]);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

    // Scraping State
    const [showUrlModal, setShowUrlModal] = useState(false);

    const inputRef = useRef<HTMLTextAreaElement>(null);
    const studioChatEndRef = useRef<HTMLDivElement>(null);
    const gridScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        document.body.className = theme + '-mode';
        localStorage.setItem('app-theme', theme);
    }, [theme]);

    useEffect(() => {
        if (studioChatEndRef.current) {
            studioChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [studioChat]);

    // Fix for mobile: reset scroll when focusing an item to prevent "overscroll" state
    useEffect(() => {
        if (focusedArtifactIndex !== null && window.innerWidth <= 1024) {
            if (gridScrollRef.current) {
                gridScrollRef.current.scrollTop = 0;
            }
            window.scrollTo(0, 0);
        }
    }, [focusedArtifactIndex]);

    useEffect(() => {
        const interval = setInterval(() => {
            setPlaceholderIndex(prev => (prev + 1) % placeholders.length);
        }, 3000);
        return () => clearInterval(interval);
    }, [placeholders.length]);

    useEffect(() => {
        const fetchDynamicPlaceholders = async () => {
            try {
                const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
                if (!apiKey) return;
                const ai = new GoogleGenAI({ apiKey });
                const response = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: {
                        role: 'user',
                        parts: [{
                            text: 'Generate 20 creative, short, diverse UI component prompts (e.g. "bioluminescent task list"). Return ONLY a raw JSON array of strings. IP SAFEGUARD: Avoid referencing specific famous artists, movies, or brands.'
                        }]
                    }
                });
                const text = response.text || '[]';
                const jsonMatch = text.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    const newPlaceholders = JSON.parse(jsonMatch[0]);
                    if (Array.isArray(newPlaceholders) && newPlaceholders.length > 0) {
                        const shuffled = newPlaceholders.sort(() => 0.5 - Math.random()).slice(0, 10);
                        setPlaceholders(prev => [...prev, ...shuffled]);
                    }
                }
            } catch (e) {
                console.warn("Silently failed to fetch dynamic placeholders", e);
            }
        };
        setTimeout(fetchDynamicPlaceholders, 1000);
    }, []);

    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(event.target.value);
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
        }
    };

    const enhancePrompt = async (currentText: string): Promise<string> => {
        if (!currentText.trim()) return currentText;

        try {
            // Get the appropriate API key based on the selected model
            const apiKey = selectedModel.provider === 'google'
                ? import.meta.env.VITE_GEMINI_API_KEY
                : import.meta.env.VITE_OPENROUTER_API_KEY;

            if (!apiKey) throw new Error(`API key for ${selectedModel.provider} is not configured.`);

            const prompt = `You are a UI/UX prompt enhancement specialist. Take the user's basic prompt and transform it into a detailed, structured, and high-quality design prompt that will produce exceptional results.

User's basic prompt: "${currentText}"

Enhance this into a premium, detailed prompt that:
1. Specifies visual aesthetics (colors, typography, spacing)
2. Describes the desired user experience
3. Mentions modern design patterns or trends if relevant
4. Is clear, structured, and actionable
5. Maintains the user's original intent

Return ONLY the enhanced prompt text, nothing else. No explanations, no markdown, just the enhanced prompt.`;

            let enhancedText = '';
            for await (const chunk of streamAI({
                model: selectedModel,
                apiKey,
                prompt
            })) {
                enhancedText += chunk;
            }

            if (!enhancedText) {
                throw new Error('No response from AI');
            }

            setEnhanceError(null);
            return enhancedText;
        } catch (e: any) {
            console.error('Error enhancing prompt:', e);

            // User-friendly error messages
            let errorMsg = 'Failed to enhance prompt';
            if (e.message?.includes('quota') || e.message?.includes('429')) {
                errorMsg = 'API quota exceeded. Please try again later.';
            } else if (e.message?.includes('API_KEY')) {
                errorMsg = 'API key not configured';
            } else if (!navigator.onLine) {
                errorMsg = 'No internet connection';
            }

            setEnhanceError(errorMsg);
            return currentText;
        }
    };

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            Array.from(files).forEach((file: File) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (typeof reader.result === 'string') {
                        setInputImages(prev => [...prev, reader.result as string]);
                    }
                };
                reader.readAsDataURL(file);
            });
            setShowAttachMenu(false);
        }
    };

    const handleUrlInput = () => {
        setShowAttachMenu(false);
        setShowUrlModal(true);
    };

    const handleScrapeSubmit = async (url: string) => {
        const initialPageId = generateId();

        // Derive name from URL
        let pageName = 'index.html';
        try {
            const parsed = new URL(url);
            let path = parsed.pathname.split('/').filter(p => p).pop();
            if (path) {
                pageName = path.endsWith('.html') ? path : `${path}.html`;
            } else {
                const domain = parsed.hostname.replace('www.', '').split('.')[0];
                pageName = `${domain}.html`;
            }
        } catch (e) {
            console.error("Error parsing URL for name:", e);
        }

        const projectId = generateId(); // Generate Project ID for Import

        const initialPage: StudioPage = {
            id: initialPageId,
            name: pageName,
            artifact: {
                id: initialPageId,
                html: '<div style="display:flex;justify-content:center;align-items:center;height:100vh;color:#fff;font-family:sans-serif;background:#09090b;">Initializing Scraper...</div>',
                styleName: 'Imported Site',
                status: 'streaming'
            },
            chat: [{ role: 'model', text: `Starting import of ${url}...` }]
        };

        setActiveProjectId(projectId);
        setStudioPages([initialPage]);
        setActivePageId(initialPageId);
        setLastSyncedHtml(initialPage.artifact.html);

        // Initialize steps
        setProgressSteps([
            { id: '1', label: 'Connecting to server...', status: 'active' },
            { id: '2', label: 'Fetching website...', status: 'pending' },
            { id: '3', label: 'Processing assets...', status: 'pending' },
            { id: '4', label: 'Bundling HTML...', status: 'pending' }
        ]);

        try {
            // Step 1 Complete
            setProgressSteps(prev => prev.map(s => s.id === '1' ? { ...s, status: 'complete' } : s.id === '2' ? { ...s, status: 'active' } : s));

            // Use local server in development, specific endpoints for production
            let endpoint = '/api/scrape'; // Default (Vercel)

            if (import.meta.env.DEV) {
                endpoint = 'http://localhost:3001/api/scrape';
            } else if (window.location.hostname.includes('netlify.app')) {
                endpoint = '/.netlify/functions/scrape';
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            if (!response.ok) {
                throw new Error('Scraping failed');
            }

            // Step 2 & 3 Complete (simulated fast progression for combined backend step)
            setProgressSteps(prev => prev.map(s => (s.id === '2' || s.id === '3') ? { ...s, status: 'complete' } : s.id === '4' ? { ...s, status: 'active' } : s));

            const data = await response.json();

            // Step 4 Complete
            setProgressSteps(prev => prev.map(s => ({ ...s, status: 'complete' })));

            // Update the page with scraped HTML
            setStudioPages(prev => prev.map(p =>
                p.id === initialPageId ? {
                    ...p,
                    artifact: {
                        ...p.artifact,
                        html: data.html,
                        status: 'complete'
                    },
                    chat: [...p.chat, { role: 'model', text: `Successfully imported ${url}. You can now edit it visually or use Magic Edit.` }]
                } : p
            ));

        } catch (error: any) {
            console.error('Scraping error:', error);
            setStudioPages(prev => prev.map(p =>
                p.id === initialPageId ? {
                    ...p,
                    artifact: {
                        ...p.artifact,
                        html: `<div style="display:flex;justify-content:center;align-items:center;height:100vh;color:#ff6b6b;flex-direction:column;gap:1rem;">
                                <h2>Import Failed</h2>
                                <p>${error.message}</p>
                               </div>`,
                        status: 'error'
                    },
                    chat: [...p.chat, { role: 'model', text: `Failed to import ${url}. Is the server running?` }]
                } : p
            ));
            setProgressSteps(prev => prev.map(s => ({ ...s, status: 'error' })));
        }
    };

    const handleMagicEnhanceMain = async () => {
        if (!inputValue.trim() || isEnhancingMain) return;

        setIsEnhancingMain(true);
        setEnhanceError(null);
        const enhanced = await enhancePrompt(inputValue);
        setInputValue(enhanced);
        setIsEnhancingMain(false);

        if (inputRef.current) {
            setTimeout(() => {
                inputRef.current!.style.height = 'auto';
                inputRef.current!.style.height = `${inputRef.current!.scrollHeight}px`;
                inputRef.current?.focus();
            }, 0);
        }

        // Auto-clear error after 5 seconds
        if (enhanceError) {
            setTimeout(() => setEnhanceError(null), 5000);
        }
    };

    const removeImage = (index: number) => {
        setInputImages(prev => prev.filter((_, i) => i !== index));
    };

    const clearAttachment = () => {
        setInputImages([]);
        setInputUrl(null);
    };

    const handlePaste = (event: React.ClipboardEvent) => {
        const items = event.clipboardData.items;
        for (const item of items) {
            if (item.type.indexOf('image') !== -1) {
                event.preventDefault(); // Prevent double-pasting if input handles it natively (though unlikely for text inputs)
                const file = item.getAsFile();
                if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        if (typeof reader.result === 'string') {
                            setInputImages(prev => [...prev, reader.result as string]);
                        }
                    };
                    reader.readAsDataURL(file);
                }
            }
        }
    };

    const parseJsonStream = async function* (responseStream: AsyncGenerator<string>) {
        let buffer = '';
        for await (const chunk of responseStream) {
            const text = chunk;
            if (typeof text !== 'string') continue;
            buffer += text;
            let braceCount = 0;
            let start = buffer.indexOf('{');
            while (start !== -1) {
                braceCount = 0;
                let end = -1;
                for (let i = start; i < buffer.length; i++) {
                    if (buffer[i] === '{') braceCount++;
                    else if (buffer[i] === '}') braceCount--;
                    if (braceCount === 0 && i > start) {
                        end = i;
                        break;
                    }
                }
                if (end !== -1) {
                    const jsonString = buffer.substring(start, end + 1);
                    try {
                        yield JSON.parse(jsonString);
                        buffer = buffer.substring(end + 1);
                        start = buffer.indexOf('{');
                    } catch (e) {
                        start = buffer.indexOf('{', start + 1);
                    }
                } else {
                    break;
                }
            }
        }
    };

    const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

    const handleContinueWithDesign = () => {
        if (currentSessionIndex === -1 || focusedArtifactIndex === null) return;
        const artifact = sessions[currentSessionIndex].artifacts[focusedArtifactIndex];

        const initialPageId = generateId();
        const projectId = generateId();

        const initialPage: StudioPage = {
            id: initialPageId,
            name: 'index.html',
            artifact: artifact,
            chat: [{ role: 'model', text: `Design "${artifact.styleName}" loaded. How can I help you refine this component?` }]
        };

        setStudioPages([initialPage]);
        setActivePageId(initialPageId);
        setActiveProjectId(projectId);
    };
    const handleStartBlank = () => {
        const initialPageId = generateId();
        const projectId = generateId();

        const initialPage: StudioPage = {
            id: initialPageId,
            name: 'index.html',
            artifact: {
                id: initialPageId,
                html: '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>New Project</title>\n    <style>\n        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f0f0f0; }\n        h1 { color: #333; }\n    </style>\n</head>\n<body>\n    <h1>Start Building</h1>\n</body>\n</html>',
                styleName: 'Blank Canvas',
                status: 'complete'
            },
            chat: [{ role: 'model', text: `Started with a blank canvas. What would you like to build?` }]
        };

        setStudioPages([initialPage]);
        setActivePageId(initialPageId);
        setActiveProjectId(projectId);
    };
    const handleStudioPaste = (event: React.ClipboardEvent) => {
        const items = event.clipboardData.items;
        for (const item of items) {
            if (item.type.indexOf('image') !== -1) {
                event.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        if (typeof reader.result === 'string') {
                            setStudioImages(prev => [...prev, reader.result as string]);
                        }
                    };
                    reader.readAsDataURL(file);
                }
            }
        }
    };

    // Existing handleStudioEdit function starts here
    const handleStudioEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!studioInputValue.trim() || !studioArtifact || isLoading) return;

        const userMsg = studioInputValue;
        setStudioInputValue('');
        setStudioImages([]); // Clear after sending
        setIsLoading(true);
        setStudioChat(prev => [...prev, { role: 'user', text: userMsg }]);

        // Initialize steps
        setProgressSteps([
            { id: '1', label: 'Analyzing request...', status: 'active' },
            { id: '2', label: 'Generating code...', status: 'pending' },
            { id: '3', label: 'Updating preview...', status: 'pending' }
        ]);

        try {
            // Get the appropriate API key based on the selected model
            const apiKey = selectedModel.provider === 'google'
                ? import.meta.env.VITE_GEMINI_API_KEY
                : import.meta.env.VITE_OPENROUTER_API_KEY;

            // Context Awareness: Find the "Home" page (first page or named index.html)
            const homePage = studioPages.find(p => p.name === 'index.html') || studioPages[0];
            const isHomePage = activePageId === homePage?.id;

            const contextPrompt = (!isHomePage && homePage) ? `
**PROJECT CONTEXT (Home Page):**
The user is building a multi-page website. 
Below is the HTML of the main "Home" page. 
You MUST maintain design consistency with this (e.g., same Navigation Bar, Footer, Typography, Color Palette).
Reference Home Page HTML:
\`\`\`html
${homePage.artifact.html}
\`\`\`
` : '';

            const prompt = `
You are Flash UI Editor. The user wants to modify their current UI component.
Current Component HTML:
\`\`\`html
${studioArtifact.html}
\`\`\`

${contextPrompt}

User Request: "${userMsg}"
${studioUrl ? `Reference URL: ${studioUrl}` : ''}

**STRICT RULES:**
1. Return ONLY the full, updated RAW HTML for the CURRENT component/page. 
2. Maintain the design language: ${studioArtifact.styleName}.
3. If this is a new sub-page, ensure it shares the Navigation and Footer from the Project Context (if provided).
4. No conversational text. No markdown fences.
`.trim();

            const contentParts: any[] = [{ text: prompt }];

            // Add studio images if any
            studioImages.forEach(img => {
                const base64Data = img.split(',')[1];
                contentParts.push({
                    inlineData: {
                        data: base64Data,
                        mimeType: 'image/png'
                    }
                });
            });

            // Update step 1 to complete, step 2 to active
            setProgressSteps(prev => prev.map(s =>
                s.id === '1' ? { ...s, status: 'complete' } :
                    s.id === '2' ? { ...s, status: 'active' } : s
            ));

            let accumulatedHtml = '';
            for await (const chunk of streamAI({
                model: selectedModel,
                apiKey,
                prompt,
                images: studioImages
            })) {
                accumulatedHtml += chunk;
                setStudioArtifact(prev => prev ? { ...prev, html: accumulatedHtml } : null);

                // Update step 2 to complete, step 3 to active (streaming starts)
                setProgressSteps(prev => {
                    // Only update once when it changes
                    if (prev[1].status !== 'complete') {
                        return prev.map(s =>
                            s.id === '2' ? { ...s, status: 'complete' } :
                                s.id === '3' ? { ...s, status: 'active' } : s
                        );
                    }
                    return prev;
                });
            }

            let finalHtml = accumulatedHtml.trim();
            if (finalHtml.startsWith('```html')) finalHtml = finalHtml.substring(7).trimStart();
            if (finalHtml.startsWith('```')) finalHtml = finalHtml.substring(3).trimStart();
            if (finalHtml.endsWith('```')) finalHtml = finalHtml.substring(0, finalHtml.length - 3).trimEnd();

            setStudioArtifact(prev => prev ? { ...prev, html: finalHtml } : null);
            setStudioChat(prev => [...prev, { role: 'model', text: "Changes applied successfully." }]);

            // All complete
            setProgressSteps(prev => prev.map(s => ({ ...s, status: 'complete' })));

        } catch (err) {
            console.error(err);
            setStudioChat(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error updating the design." }]);
            setProgressSteps(prev => prev.map(s => ({ ...s, status: 'error' })));
        } finally {
            setIsLoading(false);
            // Optional: clear steps after a delay or keep them until next input
            // setProgressSteps([]); 
        }
    };

    const handleMagicEnhanceStudio = async () => {
        if (!studioInputValue.trim() || isEnhancingStudio) return;

        setIsEnhancingStudio(true);
        setEnhanceError(null);
        const enhanced = await enhancePrompt(studioInputValue);
        setStudioInputValue(enhanced);
        setIsEnhancingStudio(false);

        // Auto-clear error after 5 seconds
        if (enhanceError) {
            setTimeout(() => setEnhanceError(null), 5000);
        }
    };

    const handleGenerateVariations = useCallback(async () => {
        const currentSession = sessions[currentSessionIndex];
        if (!currentSession || focusedArtifactIndex === null) return;
        const currentArtifact = currentSession.artifacts[focusedArtifactIndex];

        setIsLoading(true);
        setComponentVariations([]);
        setDrawerState({ isOpen: true, mode: 'variations', title: 'Variations', data: currentArtifact.id });

        try {
            // Get the appropriate API key based on the selected model
            const apiKey = selectedModel.provider === 'google'
                ? import.meta.env.VITE_GEMINI_API_KEY
                : import.meta.env.VITE_OPENROUTER_API_KEY;

            if (!apiKey) throw new Error(`API key for ${selectedModel.provider} is not configured.`);

            const prompt = `
You are a master UI/UX designer. Generate 3 RADICAL CONCEPTUAL VARIATIONS of: "${currentSession.prompt}".

**STRICT IP SAFEGUARD:**
No names of artists. 
Instead, describe the *Physicality* and *Material Logic* of the UI.

**YOUR TASK:**
For EACH variation:
- Invent a unique design persona name based on a NEW physical metaphor.
- Rewrite the prompt to fully adopt that metaphor's visual language.
- Generate high-fidelity HTML/CSS.

Required JSON Output Format (stream ONE object per line):
\`{ "name": "Persona Name", "html": "..." }\`
        `.trim();

            const responseStream = streamAI({
                model: selectedModel,
                apiKey,
                prompt
            });

            for await (const variation of parseJsonStream(responseStream)) {
                if (variation.name && variation.html) {
                    setComponentVariations(prev => [...prev, variation]);
                }
            }
        } catch (e: any) {
            console.error("Error generating variations:", e);
        } finally {
            setIsLoading(false);
        }
    }, [sessions, currentSessionIndex, focusedArtifactIndex]);

    const applyVariation = (html: string) => {
        if (focusedArtifactIndex === null) return;
        setSessions(prev => prev.map((sess, i) =>
            i === currentSessionIndex ? {
                ...sess,
                artifacts: sess.artifacts.map((art, j) =>
                    j === focusedArtifactIndex ? { ...art, html, status: 'complete' } : art
                )
            } : sess
        ));
        setDrawerState(s => ({ ...s, isOpen: false }));
    };

    const handleShowCode = () => {
        if (studioPages.length > 0 && activePageId) {
            const page = studioPages.find(p => p.id === activePageId);
            if (page) {
                setDrawerState({ isOpen: true, mode: 'code', title: `Source Code (${page.name})`, data: page.artifact.html });
            }
        } else {
            // Fallback for non-studio view
            const currentSession = sessions[currentSessionIndex];
            if (currentSession && focusedArtifactIndex !== null) {
                const artifact = currentSession.artifacts[focusedArtifactIndex];
                setDrawerState({ isOpen: true, mode: 'code', title: 'Source Code', data: artifact.html });
            }
        }
    };

    const handleAddPage = () => {
        if (!activePage) return;

        const newId = generateId();
        const baseStyle = activePage.artifact.styleName;

        const newPage: StudioPage = {
            id: newId,
            name: `page-${studioPages.length + 1}.html`,
            artifact: {
                ...activePage.artifact,
                id: newId,
                html: '<!DOCTYPE html>\n<html>\n<head>\n<title>New Page</title>\n</head>\n<body>\n<h1>New Page</h1>\n</body>\n</html>',
                status: 'complete'
            },
            chat: [{ role: 'model', text: `Created new page with style "${baseStyle}". What should we build here?` }]
        };

        setStudioPages(prev => [...prev, newPage]);
        setActivePageId(newId);
    };

    const handleSendMessage = useCallback(async (manualPrompt?: string) => {
        const promptToUse = manualPrompt || inputValue;
        let trimmedInput = promptToUse.trim();

        if ((!trimmedInput && inputImages.length === 0 && !inputUrl) || isLoading) return;
        if (!manualPrompt) {
            setInputValue('');
            setInputImages([]); // Clear after send
            setInputUrl(null);
            if (inputRef.current) {
                inputRef.current.style.height = 'auto';
            }
        }

        setIsLoading(true);
        const baseTime = Date.now();
        const sessionId = generateId();

        // Multimodal Prompt Construction
        let finalPrompt = trimmedInput;
        if (inputUrl) {
            finalPrompt = `Replicate the design of this website: ${inputUrl}. Extract and recreate the HTML, CSS, and JS to match it exactly. ${trimmedInput}`;
        }
        if (inputImages.length > 0) {
            finalPrompt = `Analyze these UI screenshots and recreate it as a high-fidelity HTML/CSS component. ${trimmedInput}`;
        }

        // If empty input but has attachment, use a default prompt
        if (!finalPrompt.trim()) {
            finalPrompt = inputUrl ? `Replicate ${inputUrl}` : "Recreate this UI design";
        }

        // Capture specific inputs for this session scope to avoid closure staleness if we used state directly
        const currentInputImages = [...inputImages];
        const currentInputUrl = inputUrl;

        const placeholderArtifacts: Artifact[] = Array(3).fill(null).map((_, i) => ({
            id: `${sessionId}_${i}`,
            styleName: 'Designing...',
            html: '',
            status: 'streaming',
        }));

        const newSession: Session = {
            id: sessionId,
            prompt: finalPrompt,
            timestamp: baseTime,
            artifacts: placeholderArtifacts
        };

        setSessions(prev => [...prev, newSession]);
        setCurrentSessionIndex(sessions.length);
        setFocusedArtifactIndex(null);

        try {
            // Get the appropriate API key based on the selected model
            const apiKey = selectedModel.provider === 'google'
                ? import.meta.env.VITE_GEMINI_API_KEY
                : import.meta.env.VITE_OPENROUTER_API_KEY;

            if (!apiKey) throw new Error(`API key for ${selectedModel.provider} is not configured.`);

            // Style Generation
            const stylePrompt = `
Generate 3 distinct, highly evocative design directions for: "${finalPrompt}".
Return ONLY a raw JSON array of 3 * NEW *, creative names for these directions.
        `.trim();

            let generatedStyles: string[] = [];
            let styleText = '';

            try {
                // Use selectedModel for styles too? Or stick to Gemini for consistency/speed if small?
                // Let's use selectedModel.
                for await (const chunk of streamAI({
                    model: selectedModel,
                    apiKey,
                    prompt: stylePrompt
                })) {
                    styleText += chunk;
                }

                const jsonMatch = styleText.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    generatedStyles = JSON.parse(jsonMatch[0]);
                }
            } catch (e) {
                console.warn("Failed to generate/parse styles, using fallbacks", e);
            }

            if (!generatedStyles || generatedStyles.length < 3) {
                generatedStyles = [
                    "Primary Pigment Gridwork",
                    "Tactile Risograph Layering",
                    "Kinetic Silhouette Balance"
                ];
            }

            generatedStyles = generatedStyles.slice(0, 3);

            setSessions(prev => prev.map(s => {
                if (s.id !== sessionId) return s;
                return {
                    ...s,
                    artifacts: s.artifacts.map((art, i) => ({
                        ...art,
                        styleName: generatedStyles[i]
                    }))
                };
            }));

            const generateArtifact = async (artifact: Artifact, styleInstruction: string) => {
                try {
                    const prompt = `
You are Flash UI. Create a stunning, high-fidelity UI component based on this request: "${finalPrompt}".
**CONCEPTUAL DIRECTION: ${styleInstruction}**
Return ONLY RAW HTML. No markdown fences.
          `.trim();

                    let accumulatedHtml = '';

                    // Stream content
                    for await (const chunk of streamAI({
                        model: selectedModel,
                        apiKey,
                        prompt,
                        images: currentInputImages // Base64 data URLs
                    })) {
                        accumulatedHtml += chunk;
                        const autoScrollScript = `
                                <script>
                                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                                    document.documentElement.scrollTop = document.documentElement.scrollHeight;
                                </script>
                            `;
                        setSessions(prev => prev.map(sess =>
                            sess.id === sessionId ? {
                                ...sess,
                                artifacts: sess.artifacts.map(art =>
                                    art.id === artifact.id ? { ...art, html: accumulatedHtml + autoScrollScript } : art
                                )
                            } : sess
                        ));
                    }

                    let finalHtml = accumulatedHtml.trim();
                    if (finalHtml.startsWith('```html')) finalHtml = finalHtml.substring(7).trimStart();
                    if (finalHtml.startsWith('```')) finalHtml = finalHtml.substring(3).trimStart();
                    if (finalHtml.endsWith('```')) finalHtml = finalHtml.substring(0, finalHtml.length - 3).trimEnd();

                    setSessions(prev => prev.map(sess =>
                        sess.id === sessionId ? {
                            ...sess,
                            artifacts: sess.artifacts.map(art =>
                                art.id === artifact.id ? { ...art, html: finalHtml, status: finalHtml ? 'complete' : 'error' } : art
                            )
                        } : sess
                    ));

                } catch (e: any) {
                    console.error('Error generating artifact:', e);
                    setSessions(prev => prev.map(sess =>
                        sess.id === sessionId ? {
                            ...sess,
                            artifacts: sess.artifacts.map(art =>
                                art.id === artifact.id ? { ...art, html: `<div style="color: #ff6b6b; padding: 20px;">Error: ${e.message}</div>`, status: 'error' } : art
                            )
                        } : sess
                    ));
                }
            };

            await Promise.all(placeholderArtifacts.map((art, i) => generateArtifact(art, generatedStyles[i])));

        } catch (e) {
            console.error("Fatal error in generation process", e);
        } finally {
            setIsLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [inputValue, isLoading, sessions.length, inputImages, inputUrl, selectedModel]);

    const handleSurpriseMe = () => {
        const currentPrompt = placeholders[placeholderIndex];
        setInputValue(currentPrompt);
        handleSendMessage(currentPrompt);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey && !isLoading) {
            event.preventDefault();
            handleSendMessage();
        } else if (event.key === 'Tab' && !inputValue && !isLoading) {
            event.preventDefault();
            const text = placeholders[placeholderIndex];
            setInputValue(text);
            if (inputRef.current) {
                setTimeout(() => {
                    inputRef.current!.style.height = 'auto';
                    inputRef.current!.style.height = `${inputRef.current!.scrollHeight}px`;
                }, 0);
            }
        }
    };

    const nextItem = useCallback(() => {
        if (focusedArtifactIndex !== null) {
            if (focusedArtifactIndex < 2) setFocusedArtifactIndex(focusedArtifactIndex + 1);
        } else {
            if (currentSessionIndex < sessions.length - 1) setCurrentSessionIndex(currentSessionIndex + 1);
        }
    }, [currentSessionIndex, sessions.length, focusedArtifactIndex]);

    const prevItem = useCallback(() => {
        if (focusedArtifactIndex !== null) {
            if (focusedArtifactIndex > 0) setFocusedArtifactIndex(focusedArtifactIndex - 1);
        } else {
            if (currentSessionIndex > 0) setCurrentSessionIndex(currentSessionIndex - 1);
        }
    }, [currentSessionIndex, focusedArtifactIndex]);

    const isLoadingDrawer = isLoading && drawerState.mode === 'variations' && componentVariations.length === 0;

    const hasStarted = (sessions.length > 0 || isLoading) && !studioArtifact;
    const currentSession = sessions[currentSessionIndex];

    let canGoBack = false;
    let canGoForward = false;

    if (hasStarted) {
        if (focusedArtifactIndex !== null) {
            canGoBack = focusedArtifactIndex > 0;
            canGoForward = focusedArtifactIndex < (currentSession?.artifacts.length || 0) - 1;
        } else {
            canGoBack = currentSessionIndex > 0;
            canGoForward = currentSessionIndex < sessions.length - 1;
        }
    }

    // Visual Editor Logic
    const [activeTab, setActiveTab] = useState<'chat'>('chat');
    const [selectedElement, setSelectedElement] = useState<{ selector: string, text: string, tagName: string } | null>(null);
    const [isCodeView, setIsCodeView] = useState(false);

    const isInternalUpdate = useRef(false);
    const [lastSyncedHtml, setLastSyncedHtml] = useState('');

    useEffect(() => {
        if (studioArtifact) {
            // If we are in code view, we always want to sync because the iframe isn't rendered (no reload risk)
            // If in preview, we skip sync if it's an internal update to prevent reload
            if (isInternalUpdate.current && !isCodeView) {
                isInternalUpdate.current = false;
                return;
            }
            setLastSyncedHtml(studioArtifact.html);
            // Reset flag just in case
            isInternalUpdate.current = false;
        } else {
            setLastSyncedHtml('');
        }
    }, [studioArtifact?.html, studioArtifact?.id, isCodeView]);
    const [viewMode, setViewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
    const [isMagicEditActive, setIsMagicEditActive] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'elementSelected') {
                setSelectedElement(event.data);
                // No sidebar tab to switch to anymore
            } else if (event.data && event.data.type === 'contentUpdated') {
                updateHtmlContent(event.data.text, event.data.selector);
            } else if (event.data && event.data.type === 'contextMenu') {
                // Calculate position relative to the preview container
                // We need to account for the iframe offset if possible, 
                // but simpler to use the mouse event from the iframe + iframe offset
                // For now, let's just use the iframe's bounding rect
                if (iframeRef.current) {
                    const iframeRect = iframeRef.current.getBoundingClientRect();
                    setContextMenu({
                        visible: true,
                        x: iframeRect.left + event.data.x,
                        y: iframeRect.top + event.data.y,
                        selector: event.data.selector,
                        currentHref: event.data.currentHref,
                        tagName: event.data.tagName,
                        layers: event.data.parents || event.data.layers, // Fallback
                        children: event.data.children,
                        elementColors: event.data.elementColors
                    });
                }
            } else if (event.data && event.data.type === 'closeContextMenu') {
                setContextMenu(prev => ({ ...prev, visible: false }));
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [studioArtifact, activePageId]); // Added activePageId to ensure listener updates when page switches

    // Close context menu on click elsewhere
    useEffect(() => {
        const closeMenu = () => setContextMenu(prev => ({ ...prev, visible: false }));
        window.addEventListener('click', closeMenu);
        return () => window.removeEventListener('click', closeMenu);
    }, []);

    // Effect to toggle magic mode in iframe
    useEffect(() => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
                type: 'setMagicMode',
                enabled: isMagicEditActive
            }, '*');
        }
    }, [isMagicEditActive, studioArtifact]); // Re-send when artifact (iframe src) changes/reloads

    const updateHtmlContent = (newText: string, selectorOverride?: string) => {
        if (!studioArtifact || !activePageId) return;
        const selector = selectorOverride || selectedElement?.selector;
        if (!selector) return;

        isInternalUpdate.current = true;

        const parser = new DOMParser();
        const doc = parser.parseFromString(studioArtifact.html, 'text/html');
        const el = doc.querySelector(selector);
        if (el) {
            el.textContent = newText;
            if (selectedElement && selectedElement.selector === selector) {
                setSelectedElement({ ...selectedElement, text: newText });
            }

            const isFullPage = studioArtifact.html.trim().toLowerCase().startsWith('<!doctype') || studioArtifact.html.trim().toLowerCase().startsWith('<html');
            if (isFullPage) {
                setStudioArtifact({ ...studioArtifact, html: doc.documentElement.outerHTML });
            } else {
                setStudioArtifact({ ...studioArtifact, html: doc.body.innerHTML });
            }
        }
    };

    const handleLinkUpdate = (url: string) => {
        if (!studioArtifact || !contextMenu.selector) return;

        const parser = new DOMParser();
        const doc = parser.parseFromString(studioArtifact.html, 'text/html');
        const el = doc.querySelector(contextMenu.selector);

        if (el) {
            // Check if element itself is an anchor or has a parent anchor
            const anchor = el.tagName.toLowerCase() === 'a' ? el : el.closest('a');

            if (anchor) {
                anchor.setAttribute('href', url);
            } else {
                // Wrap in <a>
                const link = doc.createElement('a');
                link.href = url;
                // Preserve classes/styles on the wrapper? 
                // Or verify if element is block/inline. 
                // Safest to just wrap content, but if it's a button, wrap the button.
                el.parentNode?.insertBefore(link, el);
                link.appendChild(el);
            }

            const isFullPage = studioArtifact.html.trim().toLowerCase().startsWith('<!doctype') || studioArtifact.html.trim().toLowerCase().startsWith('<html');
            if (isFullPage) {
                setStudioArtifact({ ...studioArtifact, html: doc.documentElement.outerHTML });
            } else {
                setStudioArtifact({ ...studioArtifact, html: doc.body.innerHTML });
            }
        }
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    const extractColorsFromHtml = (html: string) => {
        // Find hex and rgb/rgba colors. Also captures some CSS variables if they look like colors.
        const colorRegex = /#(?:[0-9a-fA-F]{3,4}){1,2}|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/gi;
        const matches = html.match(colorRegex) || [];
        // Unique colors, simplified
        return Array.from(new Set(matches.map(c => c.toLowerCase()))).filter(c => {
            // Filter out common false positives if any, or just keep all
            return c.length > 3;
        });
    };

    const handleThemeColorChange = (oldColor: string, newColor: string) => {
        if (!studioArtifact) return;

        let newHtml = studioArtifact.html;
        if (isGlobalThemeEdit) {
            // Global replace: strictly matches the color string
            const escapedOld = oldColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedOld, 'gi');
            newHtml = newHtml.replace(regex, newColor);
        } else if (contextMenu.selector) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(newHtml, 'text/html');
            const el = doc.querySelector(contextMenu.selector) as HTMLElement;
            if (el) {
                if (editingProperty) {
                    // Property-specific update
                    if (editingProperty === 'text') el.style.color = newColor;
                    else if (editingProperty === 'background') el.style.backgroundColor = newColor;
                    else if (editingProperty === 'border') el.style.borderColor = newColor;
                } else {
                    const style = el.getAttribute('style') || '';
                    const escapedOld = oldColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(escapedOld, 'gi');

                    if (regex.test(style)) {
                        el.setAttribute('style', style.replace(regex, newColor));
                    } else {
                        el.style.color = newColor;
                    }
                }

                const isFullPage = studioArtifact.html.trim().toLowerCase().startsWith('<!doctype') || studioArtifact.html.trim().toLowerCase().startsWith('<html');
                newHtml = isFullPage ? doc.documentElement.outerHTML : doc.body.innerHTML;
            }
        }

        setStudioArtifact({ ...studioArtifact, html: newHtml });
        // Refresh extracted colors based on the new HTML
        setThemeColors(extractColorsFromHtml(newHtml));
        setEditingColor(newColor);
    };

    const handleDeleteElement = () => {
        if (iframeRef.current && iframeRef.current.contentWindow && contextMenu.selector) {
            iframeRef.current.contentWindow.postMessage({
                type: 'deleteElement',
                selector: contextMenu.selector
            }, '*');
            setContextMenu(prev => ({ ...prev, visible: false }));
        }
    };

    const handleSelectLayer = (selector: string) => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
                type: 'selectLayer',
                selector: selector
            }, '*');
            setContextMenu(prev => ({ ...prev, visible: false }));
        }
    };

    const handleHighlightLayer = (selector: string | null) => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
                type: 'highlightLayer',
                selector: selector
            }, '*');
        }
    };

    const handleImageReplaceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !contextMenu.selector) return;

        console.log("🔧 Starting Image Replacement for selector:", contextMenu.selector);

        const reader = new FileReader();
        reader.onloadend = () => {
            try {
                const base64 = reader.result as string;

                isInternalUpdate.current = true;

                setStudioArtifact(prevArt => {
                    if (!prevArt) return prevArt;

                    try {
                        const p = new DOMParser();
                        const d = p.parseFromString(prevArt.html, 'text/html');
                        const targetEl = d.querySelector(contextMenu.selector);

                        if (!targetEl) return prevArt;

                        const tagName = targetEl.tagName.toLowerCase();

                        // Handle standard <img> tags
                        if (tagName === 'img') {
                            targetEl.setAttribute('src', base64);
                            targetEl.removeAttribute('srcset');
                            targetEl.removeAttribute('sizes');
                            targetEl.removeAttribute('data-src');
                            targetEl.removeAttribute('data-lazy-src');
                            targetEl.removeAttribute('data-original');
                            targetEl.removeAttribute('data-lazy');
                            targetEl.removeAttribute('loading');
                            targetEl.removeAttribute('decoding');
                            targetEl.removeAttribute('fetchpriority');

                            if (targetEl.parentElement?.tagName.toLowerCase() === 'picture') {
                                const sources = targetEl.parentElement.querySelectorAll('source');
                                sources.forEach(s => s.removeAttribute('srcset'));
                            }
                        }
                        // Handle SVG <image> elements
                        else if (tagName === 'image' && targetEl.namespaceURI === 'http://www.w3.org/2000/svg') {
                            targetEl.setAttribute('href', base64);
                            targetEl.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', base64);
                        }
                        // Handle background images
                        else if (targetEl.style.backgroundImage || targetEl.getAttribute('style')?.includes('background')) {
                            const currentStyle = targetEl.getAttribute('style') || '';
                            const newStyle = currentStyle.replace(/background-image\s*:\s*url\([^)]+\)/gi, `background-image: url(${base64})`);
                            if (!newStyle.includes('background-image')) {
                                targetEl.setAttribute('style', currentStyle + `; background-image: url(${base64})`);
                            } else {
                                targetEl.setAttribute('style', newStyle);
                            }
                        }
                        // Handle object/embed
                        else if (tagName === 'object' || tagName === 'embed') {
                            targetEl.setAttribute('data', base64);
                        }

                        const isFullPage = prevArt.html.toLowerCase().includes('<html') || prevArt.html.toLowerCase().includes('<!doctype');
                        const newHtml = isFullPage ? d.documentElement.outerHTML : d.body.innerHTML;

                        return { ...prevArt, html: newHtml };
                    } catch (parseErr) {
                        return prevArt;
                    }
                });

                setContextMenu(prev => ({ ...prev, visible: false }));

                // Send message to iframe for immediate update without reload
                if (iframeRef.current && iframeRef.current.contentWindow) {
                    iframeRef.current.contentWindow.postMessage({
                        type: 'updateImage',
                        selector: contextMenu.selector,
                        base64: base64
                    }, '*');
                }

                // Reset file input
                e.target.value = '';
            } catch (err) {
                console.error("💥 Fatal error in handleImageReplaceFile callback:", err);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleDownloadCode = async () => {
        if (studioPages.length > 0) {
            const zip = new JSZip();
            studioPages.forEach(page => {
                let fileName = page.name;
                if (!fileName.endsWith('.html')) fileName += '.html';
                zip.file(fileName, page.artifact.html);
            });

            const content = (await zip.generateAsync({ type: 'blob' })) as any as Blob;
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'project-source.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else if (studioArtifact) {
            // Fallback single file
            const blob = new Blob([studioArtifact.html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'index.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const getVisualEditorScript = (initialState: boolean) => `
    <script>
      (function() {
        let isMagicMode = ${initialState};

        function rgbToHex(rgb) {
            if (!rgb) return '';
            if (rgb.startsWith('#')) return rgb;
            const match = rgb.match(/^rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*[\\d.]+)?\\)$/);
            if (!match) return rgb;
            const r = parseInt(match[1]);
            const g = parseInt(match[2]);
            const b = parseInt(match[3]);
            return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        }

        window.addEventListener('message', (e) => {
            if (e.data && e.data.type === 'setMagicMode') {
                isMagicMode = e.data.enabled;
                if (!isMagicMode) {
                    // Cleanup when disabled
                    if (selectedElement) {
                        selectedElement.style.outline = '';
                        selectedElement.contentEditable = 'false';
                        selectedElement = null;
                    }
                    if (highlightedElement) {
                        highlightedElement.style.outline = '';
                        highlightedElement = null;
                    }
                }
            } else if (e.data && e.data.type === 'updateImage') {
                const el = document.querySelector(e.data.selector);
                if (el) {
                    const tagName = el.tagName.toLowerCase();
                    
                    // Handle standard <img> tags
                    if (tagName === 'img') {
                        el.src = e.data.base64;
                        el.removeAttribute('srcset');
                        el.removeAttribute('sizes');
                        el.removeAttribute('data-src');
                        el.removeAttribute('data-lazy-src');
                        el.removeAttribute('data-original');
                        el.removeAttribute('data-lazy');
                        el.removeAttribute('loading');
                        el.removeAttribute('decoding');
                        el.removeAttribute('fetchpriority');
                        
                        if (el.parentElement && el.parentElement.tagName.toLowerCase() === 'picture') {
                            const sources = el.parentElement.querySelectorAll('source');
                            sources.forEach(s => s.removeAttribute('srcset'));
                        }
                    }
                    // Handle SVG <image> elements
                    else if (tagName === 'image' && el.namespaceURI === 'http://www.w3.org/2000/svg') {
                        el.setAttribute('href', e.data.base64);
                        el.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', e.data.base64);
                    }
                    // Handle background images
                    else if (el.style.backgroundImage || el.getAttribute('style')?.includes('background')) {
                        const currentStyle = el.getAttribute('style') || '';
                        const newStyle = currentStyle.replace(/background-image\\s*:\\s*url\\([^)]+\\)/gi, 'background-image: url(' + e.data.base64 + ')');
                        if (!newStyle.includes('background-image')) {
                            el.setAttribute('style', currentStyle + '; background-image: url(' + e.data.base64 + ')');
                        } else {
                            el.setAttribute('style', newStyle);
                        }
                    }
                    // Handle object/embed tags
                    else if (tagName === 'object' || tagName === 'embed') {
                        el.setAttribute('data', e.data.base64);
                    }
                }
            } else if (e.data && e.data.type === 'deleteElement') {
                const el = document.querySelector(e.data.selector);
                if (el) {
                    el.remove();
                    // Clean up selection
                    if (selectedElement === el) {
                        selectedElement = null;
                        highlightedElement = null;
                    }
                    
                    // Notify parent to save state
                    const newHtml = document.documentElement.outerHTML;
                    window.parent.postMessage({
                       type: 'contentUpdated',
                       html: newHtml
                    }, '*');
                }
            } else if (e.data && e.data.type === 'selectLayer') {
                const el = document.querySelector(e.data.selector);
                if (el) {
                    // Update selection UI to the specific layer
                    if (selectedElement) {
                        selectedElement.style.outline = '';
                        selectedElement.contentEditable = 'false';
                    }
                    selectedElement = el;
                    selectedElement.style.outline = '2px solid #3b82f6';
                    selectedElement.contentEditable = 'true';
                    selectedElement.focus();
                    
                    // Notify parent of new selection
                    window.parent.postMessage({
                        type: 'elementSelected',
                        selector: e.data.selector,
                        text: el.innerText,
                        tagName: el.tagName
                    }, '*');
                }
            } else if (e.data && e.data.type === 'highlightLayer') {
                if (highlightedLayer && highlightedLayer !== selectedElement) {
                     highlightedLayer.style.outline = '';
                     highlightedLayer.style.boxShadow = '';
                }
                
                if (e.data.selector) {
                    const el = document.querySelector(e.data.selector);
                    if (el && el !== selectedElement) {
                        el.style.outline = '2px dashed #f59e0b';
                        el.style.boxShadow = '0 0 0 4px rgba(245, 158, 11, 0.2)';
                        highlightedLayer = el;
                    }
                } else {
                    highlightedLayer = null;
                }
            }
        });

        let highlightedElement = null;
        let highlightedLayer = null;
        let selectedElement = null;

        function getUniqueSelector(el) {
            if (!el || el.nodeType !== 1) return null;
            if (el.tagName.toLowerCase() === 'html') return 'html';
            if (el.tagName.toLowerCase() === 'body') return 'body';

            let sibling = el;
            let nth = 1;
            while (sibling.previousElementSibling) {
                sibling = sibling.previousElementSibling;
                nth++;
            }

            const selector = el.tagName.toLowerCase() + ':nth-child(' + nth + ')';
            const parent = el.parentElement;
            if (parent && parent.tagName.toLowerCase() !== 'html') {
                return getUniqueSelector(parent) + ' > ' + selector;
            }
            return selector;
        }

        function getTagLabel(el) {
            const tagName = el.tagName;
            const map = {
                'nav': 'Navigation',
                'header': 'Header',
                'footer': 'Footer',
                'main': 'Main Content',
                'section': 'Section',
                'article': 'Article',
                'aside': 'Sidebar',
                'form': 'Form',
                'input': 'Input',
                'button': 'Button',
                'label': 'Label',
                'select': 'Dropdown',
                'textarea': 'Text Area',
                'video': 'Video',
                'audio': 'Audio',
                'canvas': 'Canvas',
                'svg': 'Vector',
                'path': 'Shape',
                'rect': 'Rectangle',
                'circle': 'Circle',
                'ul': 'List',
                'ol': 'Ordered List',
                'li': 'List Item',
                'table': 'Table',
                'tr': 'Row',
                'td': 'Cell',
                'th': 'Header Cell',
                'blockquote': 'Quote',
                'code': 'Code',
                'pre': 'Code Block',
                'hr': 'Divider',
                'img': 'Image',
                'p': 'Paragraph',
                'a': 'Link',
                'div': 'Container',
                'span': 'Text Span',
                'figure': 'Figure',
                'picture': 'Responsive Image'
            };
            
            // Advanced Detection
            if (tagName === 'DIV' || tagName === 'SECTION' || tagName === 'SPAN') {
                if (el.style.backgroundImage || (el.computedStyleMap && el.computedStyleMap().get('background-image')?.toString() !== 'none')) {
                    return 'Background Image';
                }
            }
            if (tagName === 'IMAGE' && el.namespaceURI === 'http://www.w3.org/2000/svg') return 'Vector Image';
            
            const lower = tagName.toLowerCase();
            if (map[lower]) return map[lower];
            
            if (['h1','h2','h3','h4','h5','h6'].includes(lower)) return 'Heading ' + lower.substring(1);
            
            return tagName.charAt(0).toUpperCase() + tagName.slice(1).toLowerCase();
        }

        function buildLayerTree(el, depth = 0) {
            if (depth > 2) return null; // Limit recursion depth
            if (!el.children || el.children.length === 0) return null;

            const children = [];
            Array.from(el.children).forEach(child => {
                 if (child.nodeType === 1 && 
                    child.tagName !== 'SCRIPT' && 
                    child.tagName !== 'STYLE') {
                    
                    let label = getTagLabel(child);
                    if (child.id) label += ' #' + child.id;

                    children.push({
                        tagName: child.tagName,
                        className: child.className,
                        id: child.id,
                        selector: getUniqueSelector(child),
                        label: label,
                        children: buildLayerTree(child, depth + 1)
                    });
                }
            });
            return children.length > 0 ? children : null;
        }

        document.addEventListener('mouseover', (e) => {
            if (!isMagicMode) return;
            e.stopPropagation();
            // REMOVED: if (e.target.children.length > 0) return; 
            if (e.target.isContentEditable) return;

            if (highlightedElement && highlightedElement !== selectedElement) {
                highlightedElement.style.outline = '';
            }
            e.target.style.outline = '2px dashed #9ca3af';
            e.target.style.cursor = 'text';
            highlightedElement = e.target;
        }, true);

        document.addEventListener('mouseout', (e) => {
             if (!isMagicMode) return;
             e.stopPropagation();
             if (e.target !== selectedElement && !e.target.isContentEditable) {
                 e.target.style.outline = '';
             }
        }, true);

        document.addEventListener('click', (e) => {
            if (!isMagicMode) return;
            // Allow default if it's already editable to let them place cursor
            if (e.target.isContentEditable) return;

            e.preventDefault();
            e.stopPropagation();
            
            // REMOVED: if (e.target.children.length > 0) return;
            // This allows selecting elements even if they contain other elements (like formatting tags).

            if (selectedElement && selectedElement !== e.target) {
                selectedElement.style.outline = '';
                selectedElement.contentEditable = 'false';
            }

            selectedElement = e.target;
            selectedElement.style.outline = '2px solid #3b82f6';
            selectedElement.contentEditable = 'true';
            selectedElement.focus();
            
            const selector = getUniqueSelector(e.target);
            if (selector) {
                window.parent.postMessage({
                    type: 'elementSelected',
                    selector: selector,
                    text: e.target.innerText,
                    tagName: e.target.tagName
                }, '*');
                
                // Also close menu when selecting an element
                window.parent.postMessage({ type: 'closeContextMenu' }, '*');
            }
        }, true);

        let touchTimer = null;
        let touchStartPos = null;

        document.addEventListener('touchstart', (e) => {
            if (!isMagicMode) return;
            const touch = e.touches[0];
            touchStartPos = { x: touch.clientX, y: touch.clientY };
            
            touchTimer = setTimeout(() => {
                const selector = getUniqueSelector(e.target);
                if (selector) {
                    const anchor = e.target.closest('a');
                    window.parent.postMessage({
                        type: 'contextMenu',
                        selector: selector,
                        x: touch.clientX,
                        y: touch.clientY,
                        tagName: e.target.tagName,
                        currentHref: anchor ? anchor.href : null
                    }, '*');
                }
                touchTimer = null;
            }, 600); // 600ms long press
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (touchTimer) {
                const touch = e.touches[0];
                const dx = touch.clientX - touchStartPos.x;
                const dy = touch.clientY - touchStartPos.y;
                if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                    clearTimeout(touchTimer);
                    touchTimer = null;
                }
            }
        }, { passive: true });

        document.addEventListener('touchend', () => {
            if (touchTimer) {
                clearTimeout(touchTimer);
                touchTimer = null;
            }
        }, { passive: true });

        document.addEventListener('mousedown', () => {
             window.parent.postMessage({ type: 'closeContextMenu' }, '*');
        }, true);

        document.addEventListener('contextmenu', (e) => {
             if (!isMagicMode) return;
             e.preventDefault();
             e.stopPropagation();

             const selector = getUniqueSelector(e.target);
             if (selector) {
                const anchor = e.target.closest('a');
                
                // Capture all layers at the cursor position
                // Capture parent stack (ancestors)
                const elements = document.elementsFromPoint(e.clientX, e.clientY);
                const parentStack = [];
                
                // Only include elements that act as containers/parents or the target itself
                // We want to filter out siblings that might be overlapping but irrelevant
                elements.forEach((el) => {
                    if (el && 
                        el.nodeType === 1 && 
                        el.tagName !== 'HTML' && 
                        el.tagName !== 'BODY' && 
                        el.tagName !== 'SCRIPT' && 
                        el.tagName !== 'STYLE') {
                        
                        let label = getTagLabel(el);
                        if (el.id) label += ' #' + el.id;
                        
                        parentStack.push({
                            tagName: el.tagName,
                            className: el.className,
                            id: el.id,
                            selector: getUniqueSelector(el),
                            label: label
                        });
                    }
                });

                // Build child tree for the target element
                const childTree = buildLayerTree(e.target);

                // Extract computed colors
                const styles = window.getComputedStyle(e.target);
                const elementColors = {
                    text: rgbToHex(styles.color),
                    background: rgbToHex(styles.backgroundColor),
                    border: rgbToHex(styles.borderColor)
                };

                window.parent.postMessage({
                    type: 'contextMenu',
                    selector: selector,
                    x: e.clientX,
                    y: e.clientY,
                    tagName: e.target.tagName,
                    currentHref: anchor ? anchor.href : null,
                    parents: parentStack,
                    children: childTree,
                    elementColors: elementColors
                }, '*');
             }
        }, true);

        document.addEventListener('blur', (e) => {
            if (e.target.isContentEditable) {
                 const selector = getUniqueSelector(e.target);
                 window.parent.postMessage({
                    type: 'contentUpdated',
                    selector: selector,
                    text: e.target.innerText
                 }, '*');
            }
        }, true);

        // Add input listener for more frequent updates (debounced in parent if needed)
        document.addEventListener('input', (e) => {
            if (e.target.isContentEditable) {
                 const selector = getUniqueSelector(e.target);
                 window.parent.postMessage({
                    type: 'contentUpdated',
                    selector: selector,
                    text: e.target.innerText
                 }, '*');
            }
        }, true);
      })();
    </script>
  `;

    if (studioArtifact) {
        return (
            <div className={`studio-view ${isFullScreen ? 'full-screen-preview' : ''}`}>
                <div className="studio-header">
                    <div className="studio-branding">
                        <button className="mobile-toggle" onClick={() => setIsMobileChatOpen(!isMobileChatOpen)}>
                            <MenuIcon />
                        </button>
                        <button className="sidebar-toggle-btn" onClick={() => setIsMobileChatOpen(!isMobileChatOpen)} title="Toggle Chat Panel">
                            <MenuIcon />
                        </button>
                        <span className="hide-on-mobile">Project Panel</span>
                        <button className="add-page-btn" onClick={handleAddPage} title="Add New Page">
                            <PlusIcon />
                        </button>
                        <button className="add-page-btn" onClick={() => setShowUrlModal(true)} title="Import Website">
                            <LinkIcon />
                        </button>
                    </div>

                    <div className="device-switcher">
                        <button className={viewMode === 'desktop' ? 'active' : ''} onClick={() => setViewMode('desktop')} title="Desktop View">
                            <MonitorIcon />
                        </button>
                        <button className={viewMode === 'tablet' ? 'active' : ''} onClick={() => setViewMode('tablet')} title="Tablet View">
                            <TabletIcon />
                        </button>
                        <button className={viewMode === 'mobile' ? 'active' : ''} onClick={() => setViewMode('mobile')} title="Mobile View">
                            <SmartphoneIcon />
                        </button>
                    </div>

                    <div className="header-actions">
                        <button className={`header-btn ${isMagicEditActive ? 'active' : ''}`} onClick={() => setIsMagicEditActive(!isMagicEditActive)} title="Toggle Magic Edit">
                            <SparklesIcon /> <span className="hide-on-mobile">{isMagicEditActive ? 'Magic Edit On' : 'Magic Edit'}</span>
                        </button>
                        <button className={`header-btn ${isCodeView ? 'active' : ''}`} onClick={() => setIsCodeView(!isCodeView)} title="Toggle Code View">
                            <CodeIcon /> <span className="hide-on-mobile">{isCodeView ? 'View Design' : 'View Code'}</span>
                        </button>
                        <button className="header-btn" onClick={handleDownloadCode} title="Download HTML">
                            <DownloadIcon />
                        </button>
                    </div>

                    <button className="studio-close" onClick={() => {
                        setActiveProjectId(null);
                        setStudioPages([]);
                        setActivePageId(null);
                    }}><span className="hide-on-mobile">Exit Studio</span></button>
                </div>

                <div className="studio-layout">
                    <div className={`studio-sidebar ${isMobileChatOpen ? 'mobile-open' : ''}`}>
                        <div className="studio-tabs">
                            <button className={activeTab === 'chat' ? 'active' : ''} onClick={() => setActiveTab('chat')}><TerminalIcon /> Chat</button>
                        </div>

                        <div className="studio-tab-content">
                            {activeTab === 'chat' && (
                                <div className="studio-chat-container">
                                    <div className="studio-chat-history">
                                        {studioChat.map((msg, i) => (
                                            <div key={i} className={`chat-bubble ${msg.role}`}>
                                                {msg.text}
                                            </div>
                                        ))}
                                        <div ref={studioChatEndRef} />
                                    </div>

                                    {/* Progress Steps Area */}
                                    {progressSteps.length > 0 && (
                                        <div className="studio-progress-area">
                                            <ProgressSteps steps={progressSteps} />
                                        </div>
                                    )}

                                    <form className="studio-chat-input" onSubmit={handleStudioEdit}>
                                        <div className="studio-attachments">
                                            {/* Studio Previews */}
                                            {(studioImages.length > 0 || studioUrl) && (
                                                <div className="studio-previews">
                                                    {studioImages.map((img, i) => (
                                                        <div key={i} className="mini-preview" onClick={() => setStudioImages(prev => prev.filter((_, idx) => idx !== i))}>
                                                            <img src={img} alt="attachment" />
                                                            <div className="remove-overlay"><XIcon /></div>
                                                        </div>
                                                    ))}
                                                    {studioUrl && (
                                                        <div className="mini-preview url" onClick={() => setStudioUrl(null)}>
                                                            <LinkIcon />
                                                            <div className="remove-overlay"><XIcon /></div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="studio-prompt-box">
                                            <div className="studio-input-body">
                                                <textarea
                                                    placeholder="Command design changes..."
                                                    value={studioInputValue}
                                                    onChange={(e) => setStudioInputValue(e.target.value)}
                                                    onPaste={handleStudioPaste}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            // Trigger form submission manually since it's a textarea now
                                                            e.currentTarget.form?.requestSubmit();
                                                        }
                                                    }}
                                                    disabled={isLoading}
                                                    className={`studio-textarea ${isEnhancingStudio ? 'simmering' : ''}`}
                                                    rows={1}
                                                />
                                            </div>

                                            <div className="studio-input-toolbar">
                                                <div className="toolbar-left">
                                                    <StudioModelSelector
                                                        models={MODELS}
                                                        selectedModel={selectedModel}
                                                        onSelect={setSelectedModel}
                                                        disabled={isLoading}
                                                    />
                                                </div>

                                                <div className="toolbar-right">
                                                    <button
                                                        type="button"
                                                        className="studio-icon-btn"
                                                        onClick={() => studioFileInputRef.current?.click()}
                                                        title="Add Image"
                                                    >
                                                        <PlusIcon />
                                                    </button>

                                                    {studioInputValue.trim() && !isLoading && (
                                                        <button
                                                            type="button"
                                                            className={`studio-icon-btn magic ${isEnhancingStudio ? 'enhancing' : ''}`}
                                                            onClick={handleMagicEnhanceStudio}
                                                            disabled={isEnhancingStudio}
                                                            title="Enhance prompt"
                                                        >
                                                            <SparklesIcon />
                                                        </button>
                                                    )}

                                                    <button
                                                        type="submit"
                                                        className="studio-send-btn"
                                                        disabled={isLoading || (!studioInputValue.trim() && studioImages.length === 0 && !studioUrl)}
                                                    >
                                                        {isLoading ? <div className="spinner" /> : <ArrowUpIcon />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </form>
                                </div>
                            )}
                            {/* Removed unused Magic Edit sidebar logic since it's now all visual */}
                        </div>
                    </div>

                    <div className="studio-preview">
                        {studioPages.length > 0 && (
                            <div className="preview-tabs">
                                {studioPages.map(page => (
                                    <button
                                        key={page.id}
                                        className={`preview-tab ${page.id === activePageId ? 'active' : ''}`}
                                        onClick={() => setActivePageId(page.id)}
                                    >
                                        <MonitorIcon /> {/* Or file icon */}
                                        {page.name}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className={`preview-container ${viewMode}`}>
                            <div className="preview-floating-actions">
                                <button className="preview-action-btn" onClick={() => {
                                    if (studioArtifact) {
                                        const currentHtml = studioArtifact.html;
                                        setLastSyncedHtml('');
                                        setTimeout(() => setLastSyncedHtml(currentHtml), 10);
                                    }
                                }} title="Refresh Preview">
                                    <RefreshIcon />
                                </button>
                                <button className="preview-action-btn" onClick={() => setIsFullScreen(!isFullScreen)} title={isFullScreen ? "Exit Full Screen" : "Full Screen"}>
                                    {isFullScreen ? <MinimizeIcon /> : <MaximizeIcon />}
                                </button>
                            </div>
                            {isCodeView ? (
                                <div className="source-code-view full-height">
                                    <pre className="source-code-block">
                                        <code>{studioArtifact.html}</code>
                                    </pre>
                                </div>
                            ) : (
                                <iframe
                                    ref={iframeRef}
                                    srcDoc={lastSyncedHtml ? (lastSyncedHtml + getVisualEditorScript(false)) : ''}
                                    title="Studio Preview"
                                    sandbox="allow-scripts allow-same-origin"
                                    onLoad={() => {
                                        // Keep the postMessage update for dynamic toggling without reload
                                        if (iframeRef.current && iframeRef.current.contentWindow) {
                                            iframeRef.current.contentWindow.postMessage({
                                                type: 'setMagicMode',
                                                enabled: isMagicEditActive
                                            }, '*');
                                        }
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Context Menu */}
                {contextMenu.visible && (
                    <div
                        className="context-menu"
                        style={{
                            top: Math.min(contextMenu.y, window.innerHeight - 300), // Prevent bottom overflow
                            left: Math.min(contextMenu.x, window.innerWidth - 220)  // Prevent right overflow
                        }}
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
                    >
                        <div className="context-menu-item" onClick={() => {
                            const url = window.prompt("Enter URL:", contextMenu.currentHref || "https://");
                            if (url) handleLinkUpdate(url);
                        }}>
                            <LinkIcon /> {contextMenu.currentHref ? 'Edit Link' : 'Link to External URL'}
                        </div>

                        {contextMenu.tagName === 'IMG' && (
                            <div className="context-menu-item" onClick={() => replaceImageInputRef.current?.click()}>
                                <ImageIcon /> Replace Image
                            </div>
                        )}

                        <div className="context-menu-divider" />

                        {/* Parent Selection (Ancestors) */}
                        <div className="context-menu-item relative-parent" onMouseLeave={() => handleHighlightLayer(null)}>
                            <LayersIcon /> Select Parent
                            <div className="submenu left-side">
                                {contextMenu.layers?.map((layer, i) => (
                                    <div
                                        key={i}
                                        className="context-menu-item"
                                        onClick={() => handleSelectLayer(layer.selector)}
                                        onMouseEnter={() => handleHighlightLayer(layer.selector)}
                                    >
                                        <span className="layer-tag">{layer.tagName.toLowerCase()}</span>
                                        <span className="layer-label">{layer.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Explore Layers (Recursive Children) */}
                        {contextMenu.children && contextMenu.children.length > 0 && (
                            <div className="context-menu-item relative-parent" onMouseLeave={() => handleHighlightLayer(null)}>
                                <div className="menu-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                                </div>
                                <span>Explore Layers</span>
                                <div className="submenu recursive-submenu">
                                    {contextMenu.children.map((child, i) => (
                                        <RecursiveMenuItem
                                            key={i}
                                            layer={child}
                                            onSelect={handleSelectLayer}
                                            onHover={handleHighlightLayer}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="context-menu-item danger" onClick={handleDeleteElement}>
                            <TrashIcon /> Delete Element
                        </div>

                        <div className="context-menu-divider" />

                        <div className="context-menu-item" onClick={() => {
                            if (studioArtifact) {
                                setThemeColors(extractColorsFromHtml(studioArtifact.html));
                                setShowThemeEditor(true);
                                setContextMenu(prev => ({ ...prev, visible: false }));
                            }
                        }}>
                            <PaletteIcon /> Theme Editor
                        </div>

                        <div className="context-menu-divider" />

                        <div className="context-menu-header">Link to Page</div>
                        {studioPages.map(page => (
                            <div
                                key={page.id}
                                className="context-menu-item"
                                onClick={() => handleLinkUpdate(page.name)} // Assuming relative path works or handle routing logic
                            >
                                <MonitorIcon /> {page.name}
                            </div>
                        ))}
                    </div>
                )}

                <PasteUrlModal
                    isOpen={showUrlModal}
                    onClose={() => setShowUrlModal(false)}
                    onSubmit={handleScrapeSubmit}
                />

                {/* Theme Editor Panel */}
                {showThemeEditor && (
                    <div className="theme-editor-overlay" onClick={() => setShowThemeEditor(false)}>
                        <div className="theme-editor-panel" onClick={e => e.stopPropagation()}>
                            <div className="theme-editor-header">
                                <div className="header-title">
                                    <PaletteIcon />
                                    <h3>Theme Editor</h3>
                                </div>
                                <button className="close-panel-btn" onClick={() => setShowThemeEditor(false)}>
                                    <XIcon />
                                </button>
                            </div>

                            <div className="theme-editor-body">
                                <div className="theme-edit-mode">
                                    <label className="switch-label">
                                        <span>Full Website</span>
                                        <div className={`switch ${isGlobalThemeEdit ? 'on' : ''}`} onClick={() => setIsGlobalThemeEdit(!isGlobalThemeEdit)}>
                                            <div className="switch-handle" />
                                        </div>
                                    </label>
                                    <p className="mode-description">
                                        {isGlobalThemeEdit
                                            ? "Changing a color will replace it everywhere in the website."
                                            : "Changing a color will only affect the currently selected element."}
                                    </p>
                                </div>

                                <div className="extracted-colors-section">
                                    <h4>{isGlobalThemeEdit ? "Global Palette" : "Element Colors"}</h4>

                                    {!isGlobalThemeEdit && contextMenu.elementColors ? (
                                        <div className="element-colors-list">
                                            {[
                                                { label: 'Text', key: 'text', color: contextMenu.elementColors.text },
                                                { label: 'Background', key: 'background', color: contextMenu.elementColors.background },
                                                { label: 'Border', key: 'border', color: contextMenu.elementColors.border }
                                            ].map(item => (
                                                <div
                                                    key={item.key}
                                                    className={`element-color-item ${editingProperty === item.key ? 'active' : ''}`}
                                                    onClick={() => {
                                                        setEditingColor(item.color);
                                                        setEditingProperty(item.key);
                                                    }}
                                                >
                                                    <div className="swatch" style={{ backgroundColor: item.color }} />
                                                    <div className="label-area">
                                                        <span className="label">{item.label}</span>
                                                        <span className="value">{item.color}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="color-swatch-grid">
                                            {themeColors.length > 0 ? themeColors.map((color, i) => (
                                                <button
                                                    key={i}
                                                    className={`color-swatch-btn ${editingColor === color ? 'active' : ''}`}
                                                    style={{ backgroundColor: color }}
                                                    onClick={() => {
                                                        setEditingColor(color);
                                                        setEditingProperty(null);
                                                    }}
                                                    title={color}
                                                >
                                                    <div className="swatch-check">✓</div>
                                                </button>
                                            )) : (
                                                <p className="no-colors">No colors detected yet.</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {editingColor && (
                                    <div className="color-adjustment-area">
                                        <div className="adjustment-header">
                                            <span>{editingProperty ? `Adjust ${editingProperty.charAt(0).toUpperCase() + editingProperty.slice(1)}` : 'Adjust Color'}</span>
                                            <code className="current-color-code">{editingColor}</code>
                                        </div>
                                        <div className="picker-container">
                                            <input
                                                type="color"
                                                className="main-color-picker"
                                                value={editingColor.startsWith('#') && editingColor.length === 7 ? editingColor : '#3b82f6'}
                                                onChange={(e) => handleThemeColorChange(editingColor, e.target.value)}
                                            />
                                            <div className="manual-input">
                                                <input
                                                    type="text"
                                                    value={editingColor}
                                                    onChange={(e) => handleThemeColorChange(editingColor, e.target.value)}
                                                    placeholder="#hex or rgb()"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="theme-editor-footer">
                                <button className="apply-all-btn" onClick={() => setShowThemeEditor(false)}>
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <input
                    type="file"
                    ref={replaceImageInputRef}
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleImageReplaceFile}
                />
            </div>
        );
    }

    return (
        <>
            <div className="top-nav">
                <a href="https://wa.link/zf1inf" target="_blank" rel="noreferrer" className={`creator-credit ${hasStarted ? 'hide-on-mobile' : ''}`}>
                    Deepak UI
                </a>
                <button className="theme-toggle" onClick={toggleTheme}>
                    {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                </button>
                {sessions.length > 0 && (
                    <button
                        className="theme-toggle"
                        onClick={() => {
                            // Simple reset
                            setSessions([]);
                            setCurrentSessionIndex(-1);
                            // Reset input too
                            setInputValue('');
                            setInputImages([]);
                            setInputUrl(null);
                        }}
                        style={{ marginLeft: '1rem', width: 'auto', padding: '0 1rem', borderRadius: '2rem' }}
                        title="Start New Project"
                    >
                        <PlusIcon /> New
                    </button>
                )}
            </div>

            {/* Error Toast */}
            {enhanceError && (
                <div className="error-toast">
                    <span>⚠️ {enhanceError}</span>
                    <button onClick={() => setEnhanceError(null)}>×</button>
                </div>
            )}

            <SideDrawer
                isOpen={drawerState.isOpen}
                onClose={() => setDrawerState(s => ({ ...s, isOpen: false }))}
                title={drawerState.title}
            >
                {isLoadingDrawer && (
                    <div className="loading-state">
                        <ThinkingIcon />
                        Designing variations...
                    </div>
                )}

                {drawerState.mode === 'code' && (
                    <pre className="code-block"><code>{drawerState.data}</code></pre>
                )}

                {drawerState.mode === 'variations' && (
                    <div className="sexy-grid">
                        {componentVariations.map((v, i) => (
                            <div key={i} className="sexy-card" onClick={() => applyVariation(v.html)}>
                                <div className="sexy-preview">
                                    <iframe srcDoc={v.html} title={v.name} sandbox="allow-scripts allow-same-origin" />
                                </div>
                                <div className="sexy-label">{v.name}</div>
                            </div>
                        ))}
                    </div>
                )}
            </SideDrawer>

            <PasteUrlModal
                isOpen={showUrlModal}
                onClose={() => setShowUrlModal(false)}
                onSubmit={handleScrapeSubmit}
            />

            <div className="immersive-app">
                <DottedGlowBackground
                    gap={24}
                    radius={1.5}
                    color={theme === 'dark' ? "rgba(255, 255, 255, 0.02)" : "rgba(0,0,0,0.02)"}
                    glowColor={theme === 'dark' ? "rgba(255, 255, 255, 0.15)" : "rgba(0,0,0,0.1)"}
                    speedScale={0.5}
                />

                <div className={`stage-container ${focusedArtifactIndex !== null ? 'mode-focus' : 'mode-split'}`}>
                    <div className={`empty-state ${hasStarted ? 'fade-out' : ''}`}>
                        <div className="empty-content">
                            <h1>Deepak UI</h1>
                            <p>Creative UI generation in a flash</p>
                            <button className="surprise-button" onClick={handleSurpriseMe} disabled={isLoading}>
                                <SparklesIcon /> Surprise Me
                            </button>

                            {/* Template Marketplace Marquee */}
                            <div className="marketplace-marquee">
                                <div className="marquee-track">
                                    {[...MARKETPLACES, ...MARKETPLACES].map((m, i) => (
                                        <a
                                            key={i}
                                            href={m.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="marketplace-pill"
                                        >
                                            {m.name}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {sessions.map((session, sIndex) => {
                        let positionClass = 'hidden';
                        if (sIndex === currentSessionIndex) positionClass = 'active-session';
                        else if (sIndex < currentSessionIndex) positionClass = 'past-session';
                        else if (sIndex > currentSessionIndex) positionClass = 'future-session';

                        return (
                            <div key={session.id} className={`session-group ${positionClass}`}>
                                <div className="artifact-grid" ref={sIndex === currentSessionIndex ? gridScrollRef : null}>
                                    {session.artifacts.map((artifact, aIndex) => {
                                        const isFocused = focusedArtifactIndex === aIndex;

                                        return (
                                            <ArtifactCard
                                                key={artifact.id}
                                                artifact={artifact}
                                                isFocused={isFocused}
                                                onClick={() => setFocusedArtifactIndex(aIndex)}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {canGoBack && (
                    <button className="nav-handle left" onClick={prevItem} aria-label="Previous">
                        <ArrowLeftIcon />
                    </button>
                )}
                {canGoForward && (
                    <button className="nav-handle right" onClick={nextItem} aria-label="Next">
                        <ArrowRightIcon />
                    </button>
                )}

                <div className={`action-bar ${focusedArtifactIndex !== null ? 'visible' : ''}`}>
                    <div className="active-prompt-label">
                        {currentSession?.prompt}
                    </div>
                    <div className="action-buttons">
                        <button onClick={() => setFocusedArtifactIndex(null)}>
                            <GridIcon /> Grid View
                        </button>
                        <button className="accent-action" onClick={handleContinueWithDesign}>
                            <ArrowRightIcon /> Continue with this design
                        </button>
                    </div>
                </div>

                {/* Hide floating input when AI is designing OR when content exists */}
                {!isLoading && sessions.length === 0 && (
                    <div className="floating-input-container">


                        <div className="start-blank-wrapper">
                            <button type="button" onClick={handleStartBlank} className="start-blank-btn">
                                <PlusIcon /> Start with blank Project
                            </button>
                        </div>

                        {/* Previews */}
                        {(inputImages.length > 0 || inputUrl) && (
                            <div className="input-previews">
                                {inputImages.map((img, index) => (
                                    <div key={index} className="preview-chip image">
                                        <ImageIcon />
                                        <span>Image {index + 1}</span>
                                        <button onClick={() => removeImage(index)}><XIcon /></button>
                                        <img src={img} alt="Preview" className="chip-bg" />
                                    </div>
                                ))}
                                {inputUrl && (
                                    <div className="preview-chip url">
                                        <LinkIcon />
                                        <span>{inputUrl}</span>
                                        <button onClick={() => setInputUrl(null)}><XIcon /></button>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className={`input-wrapper ${isLoading ? 'loading' : ''} structured`}>
                            <div className="input-body">
                                {(!inputValue && !isLoading && inputImages.length === 0 && !inputUrl) && (
                                    <div className="animated-placeholder" key={placeholderIndex}>
                                        <span className="placeholder-text">{placeholders[placeholderIndex]}</span>
                                        <span className="tab-hint">Tab</span>
                                    </div>
                                )}

                                <textarea
                                    ref={inputRef}
                                    value={inputValue}
                                    onChange={handleInputChange}
                                    onKeyDown={handleKeyDown}
                                    onPaste={handlePaste}
                                    disabled={isLoading}
                                    className={`main-textarea ${isLoading ? 'generating' : ''} ${isEnhancingMain ? 'simmering' : ''}`}
                                    rows={1}
                                />
                            </div>


                            <div className="input-toolbar">
                                <div className="toolbar-left">
                                    <div className="model-selector-wrapper">
                                        <ModelSelector
                                            models={MODELS}
                                            selectedModel={selectedModel}
                                            onSelect={setSelectedModel}
                                            disabled={isLoading}
                                        />
                                    </div>

                                    {inputValue.trim() && !isLoading && (
                                        <button
                                            className={`magic-enhance-btn ${isEnhancingMain ? 'enhancing' : ''}`}
                                            onClick={handleMagicEnhanceMain}
                                            disabled={isEnhancingMain}
                                            title="Enhance prompt with AI"
                                            type="button"
                                        >
                                            <SparklesIcon />
                                        </button>
                                    )}
                                </div>

                                <div className="toolbar-right">
                                    <div className="attachment-wrapper">
                                        <button
                                            className={`attach-btn ${showAttachMenu ? 'active' : ''}`}
                                            onClick={() => setShowAttachMenu(!showAttachMenu)}
                                            title="Attach file or URL"
                                        >
                                            <PlusIcon />
                                        </button>
                                        {showAttachMenu && (
                                            <div className="attach-menu">
                                                <button onClick={() => fileInputRef.current?.click()}>
                                                    <ImageIcon /> Upload Image
                                                </button>
                                                <button onClick={handleUrlInput}>
                                                    <LinkIcon /> Paste URL
                                                </button>
                                            </div>
                                        )}
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            style={{ display: 'none' }}
                                            accept="image/*"
                                            multiple
                                            onChange={handleImageUpload}
                                        />
                                    </div>

                                    <button
                                        className="send-button"
                                        onClick={() => handleSendMessage()}
                                        disabled={isLoading || (!inputValue.trim() && inputImages.length === 0 && !inputUrl)}
                                        title="Send prompt"
                                    >
                                        {isLoading ? <div className="spinner" /> : <ArrowUpIcon />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <PasteUrlModal
                isOpen={showUrlModal}
                onClose={() => setShowUrlModal(false)}
                onSubmit={handleScrapeSubmit}
            />

            {/* Mobile Bottom Navigation */}
            {studioArtifact && (
                <div className="studio-mobile-nav">
                    <button
                        className={`nav-item ${isMagicEditActive ? 'active' : ''}`}
                        onClick={() => setIsMagicEditActive(!isMagicEditActive)}
                    >
                        <SparklesIcon />
                        <span>Magic</span>
                    </button>
                    <button
                        className={`nav-item ${isCodeView ? 'active' : ''}`}
                        onClick={() => setIsCodeView(!isCodeView)}
                    >
                        <CodeIcon />
                        <span>Code</span>
                    </button>
                    <button className="nav-item" onClick={handleDownloadCode}>
                        <DownloadIcon />
                        <span>Export</span>
                    </button>
                </div>
            )}
        </>
    );
}

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}