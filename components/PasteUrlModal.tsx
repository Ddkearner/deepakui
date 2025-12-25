import React, { useState } from 'react';
import { XIcon, LinkIcon } from './Icons';
import './PasteUrlModal.css';

interface PasteUrlModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (url: string) => void;
}

const PasteUrlModal: React.FC<PasteUrlModalProps> = ({ isOpen, onClose, onSubmit }) => {
    const [url, setUrl] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (url.trim()) {
            onSubmit(url.trim());
            setUrl('');
            onClose();
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <button
                    onClick={onClose}
                    className="modal-close-btn"
                >
                    <XIcon />
                </button>

                <div className="modal-body">
                    <div className="modal-header-section">
                        <div className="modal-icon-wrapper">
                            <LinkIcon />
                        </div>
                        <div className="modal-title-group">
                            <h2>Import Website</h2>
                            <p>Enter a URL to scrape and clone</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="modal-form">
                        <input
                            type="url"
                            placeholder="https://example.com"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="modal-input"
                            autoFocus
                        />
                        <div className="modal-actions">
                            <button
                                type="button"
                                onClick={onClose}
                                className="btn-cancel"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!url.trim()}
                                className="btn-primary"
                            >
                                Import
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default PasteUrlModal;
