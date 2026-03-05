import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sparkles, Plane, Users, AlertTriangle, Activity } from 'lucide-react';
import type { Entity } from '../../hooks/useWebSocket';
import { useAppStore } from '../../store/useAppStore';

interface AIOverviewProps {
    entities: Record<string, Entity>;
}

const AIOverview: React.FC<AIOverviewProps> = ({ entities }) => {
    const { isIntelPanelOpen, setIntelPanelOpen } = useAppStore();
    const [summary, setSummary] = useState<string>('Analyzing tactical theater...');
    const [displayedText, setDisplayedText] = useState<string>('');
    const [isTyping, setIsTyping] = useState(false);
    const typewriterTimer = useRef<any>(null);

    const entityList = useMemo(() => Object.values(entities), [entities]);

    const stats = useMemo(() => {
        const aircraft = entityList.filter(e => e.type === 'aircraft').length;
        const operatives = entityList.filter(e => e.type === 'operative').length;
        const security = entityList.filter(e => e.type === 'security').length;
        return { aircraft, operatives, security };
    }, [entityList]);

    const prevStats = useRef({ aircraft: 0, operatives: 0, security: 0 });

    useEffect(() => {
        if (entityList.length === 0) {
            setSummary('Waiting for Area of Interest initialization...');
            setIsTyping(false);
            return;
        }

        const generateReport = (currentStats: typeof stats) => {
            let report = `RECON REPORT INITIALIZED\n\n`;

            if (currentStats.security > 0) {
                report += `CRITICAL: ${currentStats.security} active security threat(s) detected. Perimeter integrity is compromised. `;
            } else {
                report += `Perimeter secure. No immediate security breaches registered. `;
            }

            if (currentStats.operatives > 0) {
                report += `We have ${currentStats.operatives} agents on the ground. Personnel status is ${currentStats.security > 0 ? 'HEIGHTENED.' : 'STABLE.'} `;
            }

            if (currentStats.aircraft > 0) {
                report += `Aviation traffic is currently at ${currentStats.aircraft} signals. `;
            }

            report += `\n\nRECOMMENDATION: Maintain surveillance on high-latency nodes.`;

            return report;
        };

        const hasStatsChanged =
            stats.aircraft !== prevStats.current.aircraft ||
            stats.operatives !== prevStats.current.operatives ||
            stats.security !== prevStats.current.security;

        if (hasStatsChanged || summary === 'Analyzing tactical theater...') {
            const newReport = generateReport(stats);
            setIsTyping(true);
            const timer = setTimeout(() => {
                setSummary(newReport);
                setIsTyping(false);
                prevStats.current = { ...stats };
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [stats.aircraft, stats.operatives, stats.security, entityList.length === 0, summary]);

    // Typewriter effect logic
    useEffect(() => {
        if (typewriterTimer.current) clearInterval(typewriterTimer.current);

        // Skip typewriter for very small updates (like just timestamps)
        // Or if we're in the initial loading state
        if (isTyping) {
            setDisplayedText('');
            return;
        }

        let i = 0;
        setDisplayedText('');

        typewriterTimer.current = setInterval(() => {
            setDisplayedText(summary.slice(0, i));
            i += 2; // Type 2 chars at a time for speed
            if (i > summary.length) {
                clearInterval(typewriterTimer.current);
            }
        }, 15);

        return () => clearInterval(typewriterTimer.current);
    }, [summary, isTyping]);

    return (
        <div className="flex flex-col h-full bg-black/40 backdrop-blur-xl border border-white/10 p-6 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                    <Sparkles className="w-5 h-5 text-blue-400 animate-pulse" />
                </div>
                <div>
                    <h2 className="text-md font-bold text-slate-400 ">INTELLIGENCE OFFICER</h2>
                    <p className="text-[10px] font-mono text-blue-400/60 uppercase tracking-widest font-bold">AI OVERVIEW LAYER 01</p>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-3 bg-white/[0.03] border border-white/5 rounded-xl text-center transform transition-all duration-500 hover:border-emerald-500/30">
                    <Plane className={`w-4 h-4 mx-auto mb-1 ${stats.aircraft > 0 ? 'text-emerald-400' : 'text-white/20'}`} />
                    <div className="text-3xl font-bold text-white">{stats.aircraft}</div>
                    <div className="text-[8px] font-mono text-white/30 uppercase">Air</div>
                </div>
                <div className="p-3 bg-white/[0.03] border border-white/5 rounded-xl text-center transform transition-all duration-500 hover:border-blue-500/30">
                    <Users className={`w-4 h-4 mx-auto mb-1 ${stats.operatives > 0 ? 'text-blue-400' : 'text-white/20'}`} />
                    <div className="text-3xl font-bold text-white">{stats.operatives}</div>
                    <div className="text-[8px] font-mono text-white/30 uppercase">Ops</div>
                </div>
                <div className="p-3 bg-white/[0.03] border border-white/5 rounded-xl text-center transform transition-all duration-500 hover:border-red-500/30">
                    <AlertTriangle className={`w-4 h-4 mx-auto mb-1 ${stats.security > 0 ? 'text-red-400 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'text-white/20'}`} />
                    <div className="text-3xl font-bold text-white">{stats.security}</div>
                    <div className="text-[8px] font-mono text-white/30 uppercase">Alert</div>
                </div>
            </div>

            {/* AI Report Body */}
            <div className="flex-grow relative group cursor-default">
                <div className="absolute inset-0 bg-blue-500/5 rounded-2xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative h-full bg-[#0a0a0a]/60 border border-white/10 rounded-2xl p-5 font-mono text-xs leading-relaxed overflow-y-auto custom-scrollbar shadow-inner">
                    {isTyping ? (
                        <div className="flex flex-col gap-2">
                            <div className="h-4 bg-white/10 rounded animate-pulse w-3/4" />
                            <div className="h-4 bg-white/10 rounded animate-pulse w-1/2" />
                            <div className="h-4 bg-white/10 rounded animate-pulse w-2/3" />
                        </div>
                    ) : (
                        <div className="text-white/80 whitespace-pre-wrap selection:bg-blue-500/30 min-h-full">
                            <span className="text-blue-400 font-bold mb-2 block animate-pulse underline decoration-blue-500/30 underline-offset-4 tracking-[0.1em]">{">>>"} SYSTEM ANALYSIS</span>
                            {displayedText}
                            <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-[ping_1s_infinite] align-middle" />
                        </div>
                    )}
                </div>
            </div>

            {/* Footer / Status */}
            <div className="mt-5 pt-4 border-t border-white/5 flex flex-col gap-4">
                <button
                    onClick={() => setIntelPanelOpen(!isIntelPanelOpen)}
                    className={`group relative w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-500 overflow-hidden cursor-pointer ${isIntelPanelOpen ? 'bg-blue-500/20 border-blue-500/60 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.2)]' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20 shadow-lg'}`}
                >
                    <div className="flex items-center gap-3">
                        <Activity className={`w-4 h-4 ${isIntelPanelOpen ? 'animate-pulse text-blue-400' : 'text-white/40'}`} />
                        <span className="text-[11px] font-mono font-black uppercase tracking-[0.2em]">
                            {isIntelPanelOpen ? 'Intel Stream Active' : 'Expand Raw Intel Feed'}
                        </span>
                    </div>
                    <div className={`w-1.5 h-1.5 rounded-full ${isIntelPanelOpen ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,1)]' : 'bg-white/20'}`} />

                    {/* Hover Glow Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-white/5 to-blue-500/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                </button>

                <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Cognitive Engine: ACTIVE</span>
                    </div>
                    <div className="text-[9px] font-mono text-white/20 uppercase tracking-tighter">
                        V.2.4.9-Stable
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIOverview;
