'use client';

import React, { useEffect } from 'react';
import { useSession } from 'next-auth/react';

export const GlobalClickTracker: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { data: session } = useSession();

    useEffect(() => {
        if (!session?.accessToken) return;

        const handleClick = async (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const interactiveElement = target.closest('button, a, input[type="button"], input[type="submit"], select') as HTMLElement | null;

            if (interactiveElement) {
                const tag = interactiveElement.tagName;
                let details = '';
                let action = '';

                if (tag === 'BUTTON' || (tag === 'INPUT' && ['button', 'submit'].includes((interactiveElement as HTMLInputElement).type))) {
                    action = 'Clicked Button';
                    details = interactiveElement.innerText || (interactiveElement as HTMLInputElement).value || 'Unnamed Button';
                } else if (tag === 'A') {
                    action = 'Clicked Link';
                    details = `${interactiveElement.innerText || 'Unnamed Link'} (${(interactiveElement as HTMLAnchorElement).href})`;
                } else if (tag === 'SELECT') {
                    action = 'Interacted with Dropdown';
                    details = `Opened dropdown: ${(interactiveElement as HTMLSelectElement).name || 'Unnamed'}`;
                }

                if (action) {
                    try {
                        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/activity/log`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${session.accessToken}`
                            },
                            body: JSON.stringify({
                                action,
                                details: details.trim(),
                                target_id: interactiveElement.id || undefined
                            })
                        });
                    } catch (error) {
                        // Silent fail for logging to not interrupt user flow
                        console.error('Failed to log click activity:', error);
                    }
                }
            }
        };

        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [session]);

    return <>{children}</>;
};
