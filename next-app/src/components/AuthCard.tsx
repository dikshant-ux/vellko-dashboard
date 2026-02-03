'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface AuthCardProps {
    title: ReactNode;
    subtitle: string;
    children: ReactNode;
    showSocialProof?: boolean;
}

export function AuthCard({ title, subtitle, children, showSocialProof = false }: AuthCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden min-h-[500px]"
        >
            {/* Left Section - Branding & Illustration */}
            <div className="w-full md:w-1/2 bg-[#0a0a0a] p-8 md:p-12 flex flex-col justify-between relative overflow-hidden text-white">
                {/* Animated Background SVG Shapes */}
                <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
                    <motion.svg
                        className="absolute -top-24 -left-24 w-64 h-64 text-red-600"
                        animate={{
                            scale: [1, 1.2, 1],
                            rotate: [0, 90, 0],
                            x: [0, 20, 0]
                        }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        viewBox="0 0 100 100"
                    >
                        <circle cx="50" cy="50" r="40" fill="currentColor" fillOpacity="0.2" />
                    </motion.svg>
                    <motion.svg
                        className="absolute -bottom-24 -right-24 w-80 h-80 text-red-600"
                        animate={{
                            scale: [1, 1.1, 1],
                            rotate: [0, -45, 0],
                            y: [0, -30, 0]
                        }}
                        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                        viewBox="0 0 100 100"
                    >
                        <rect x="20" y="20" width="60" height="60" rx="10" fill="currentColor" fillOpacity="0.1" />
                    </motion.svg>
                </div>

                <div className="relative z-10">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center gap-3 mb-8"
                    >
                        <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-600/20">
                            <span className="text-xl font-bold">V</span>
                        </div>
                        <span className="text-2xl font-bold tracking-tight">Vellko</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-4xl md:text-5xl font-extrabold leading-tight mb-6"
                    >
                        {title}
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="text-gray-400 text-lg max-w-sm"
                    >
                        {subtitle}
                    </motion.p>
                </div>

                {showSocialProof && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="relative z-10 mt-8"
                    >
                        <div className="flex -space-x-3 mb-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0a0a0a] bg-gray-800 flex items-center justify-center text-[10px] font-bold overflow-hidden">
                                    <img src={`https://i.pravatar.cc/100?u=${i}`} alt="user" />
                                </div>
                            ))}
                            <div className="w-8 h-8 rounded-full border-2 border-[#0a0a0a] bg-red-600 flex items-center justify-center text-[10px] font-bold">
                                +1k
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">Joined by 1,000+ marketers worldwide</p>
                    </motion.div>
                )}
            </div>

            {/* Right Section - Form */}
            <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-white">
                <div className="w-full max-w-sm mx-auto">
                    {children}
                </div>
            </div>
        </motion.div>
    );
}
