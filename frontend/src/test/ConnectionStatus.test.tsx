import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConnectionStatus from '../components/common/ConnectionStatus';

describe('ConnectionStatus', () => {
    it('renders "Connected" for connected status', () => {
        render(<ConnectionStatus status="connected" />);
        expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('renders "Disconnected" for disconnected status', () => {
        render(<ConnectionStatus status="disconnected" />);
        expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('renders "Connecting..." for connecting status', () => {
        render(<ConnectionStatus status="connecting" />);
        expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });

    it('renders "Reconnecting..." for reconnecting status', () => {
        render(<ConnectionStatus status="reconnecting" />);
        expect(screen.getByText('Reconnecting...')).toBeInTheDocument();
    });
});
