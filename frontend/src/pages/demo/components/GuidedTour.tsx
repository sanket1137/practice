// GuidedTour - Wrapper component for react-joyride tour
import React from 'react';
import Joyride, { STATUS, type CallBackProps, type Step } from 'react-joyride';

interface GuidedTourProps {
    steps: Step[];
    run: boolean;
    onFinish: () => void;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({ steps, run, onFinish }) => {
    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status } = data;
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

        if (finishedStatuses.includes(status)) {
            onFinish();
        }
    };

    return (
        <Joyride
            steps={steps}
            run={run}
            continuous
            showProgress
            showSkipButton
            callback={handleJoyrideCallback}
            styles={{
                options: {
                    zIndex: 10000,
                    primaryColor: '#1976d2',
                    arrowColor: '#fff',
                    backgroundColor: '#fff',
                    overlayColor: 'rgba(0, 0, 0, 0.7)', // Dark blur effect
                    spotlightShadow: '0 0 15px rgba(0, 0, 0, 0.5)',
                    textColor: '#333',
                },
                spotlight: {
                    borderRadius: 8,
                },
                tooltip: {
                    fontSize: 16,
                    padding: 20,
                    borderRadius: 12,
                },
                tooltipContainer: {
                    textAlign: 'left',
                },
                tooltipContent: {
                    padding: '10px 0',
                },
                buttonNext: {
                    backgroundColor: '#1976d2',
                    fontSize: 14,
                    padding: '10px 20px',
                    borderRadius: 6,
                },
                buttonBack: {
                    color: '#666',
                    marginRight: 10,
                    fontSize: 14,
                },
                buttonSkip: {
                    color: '#999',
                    fontSize: 14,
                },
            }}
            locale={{
                back: 'Back',
                close: 'Close',
                last: 'Finish Tour',
                next: 'Next',
                open: 'Open',
                skip: 'Skip Tour',
            }}
        />
    );
};
