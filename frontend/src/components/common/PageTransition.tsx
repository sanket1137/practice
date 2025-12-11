import { ReactNode } from 'react';
import { Box } from '@mui/material';
import { keyframes } from '@mui/system';

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const fadeOut = keyframes`
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
`;

interface PageTransitionProps {
    children: ReactNode;
    duration?: number;
}

export default function PageTransition({ children, duration = 300 }: PageTransitionProps) {
    return (
        <Box
            sx={{
                animation: `${fadeIn} ${duration}ms ease-out`,
                willChange: 'opacity, transform',
            }}
        >
            {children}
        </Box>
    );
}

// Staggered children animation
export function StaggeredList({ children, delay = 50 }: { children: ReactNode[]; delay?: number }) {
    return (
        <>
            {Array.isArray(children) &&
                children.map((child, index) => (
                    <Box
                        key={index}
                        sx={{
                            animation: `${fadeIn} 300ms ease-out`,
                            animationDelay: `${index * delay}ms`,
                            animationFillMode: 'backwards',
                        }}
                    >
                        {child}
                    </Box>
                ))}
        </>
    );
}
