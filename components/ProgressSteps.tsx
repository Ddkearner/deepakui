
import React from 'react';
import { ThinkingIcon } from './Icons';

export type StepStatus = 'pending' | 'active' | 'complete' | 'error';

export interface ProgressStep {
    id: string;
    label: string;
    status: StepStatus;
}

interface ProgressStepsProps {
    steps: ProgressStep[];
}

const ProgressSteps: React.FC<ProgressStepsProps> = ({ steps }) => {
    if (steps.length === 0) return null;

    return (
        <div className="progress-steps-container">
            {steps.map((step, index) => (
                <div key={step.id} className={`progress-step ${step.status}`}>
                    <div className="step-icon">
                        {step.status === 'active' && <ThinkingIcon />}
                        {step.status === 'complete' && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        )}
                        {step.status === 'pending' && <div className="step-dot" />}
                        {step.status === 'error' && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        )}
                    </div>
                    <div className="step-label">{step.label}</div>
                    {/* {index < steps.length - 1 && <div className="step-line" />} */}
                </div>
            ))}
            <style>{`
                .progress-steps-container {
                    margin: 12px 16px;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    /* width: 100%; */
                    max-width: 400px;
                }
                .progress-step {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-size: 0.9rem;
                    color: rgba(255, 255, 255, 0.4);
                    transition: all 0.3s ease;
                }
                .progress-step.active {
                    color: var(--accent-primary, #3b82f6);
                    font-weight: 500;
                }
                .progress-step.complete {
                    color: var(--text-secondary, #9ca3af);
                }
                .progress-step.error {
                    color: #ef4444;
                }
                .step-icon {
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .step-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: currentColor;
                    opacity: 0.3;
                }
                .progress-step.active .step-dot {
                    opacity: 1;
                    box-shadow: 0 0 8px currentColor;
                }
            `}</style>
        </div>
    );
};

export default ProgressSteps;
