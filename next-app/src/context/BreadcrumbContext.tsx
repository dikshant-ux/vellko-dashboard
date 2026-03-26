'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface BreadcrumbContextType {
    labels: Record<string, string>;
    setLabel: (path: string, label: string) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(undefined);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
    const [labels, setLabels] = useState<Record<string, string>>({});

    const setLabel = React.useCallback((path: string, label: string) => {
        setLabels((prev) => {
            if (prev[path] === label) return prev;
            return { ...prev, [path]: label };
        });
    }, []);

    const value = React.useMemo(() => ({ labels, setLabel }), [labels, setLabel]);

    return (
        <BreadcrumbContext.Provider value={value}>
            {children}
        </BreadcrumbContext.Provider>
    );
}

export function useBreadcrumbs() {
    const context = useContext(BreadcrumbContext);
    if (!context) {
        throw new Error('useBreadcrumbs must be used within a BreadcrumbProvider');
    }
    return context;
}
