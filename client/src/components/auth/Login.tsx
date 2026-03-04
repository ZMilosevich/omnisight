import React, { useState } from 'react';

interface LoginProps {
    onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [status, setStatus] = useState('');

    const handleSSO = () => {
        setIsAuthenticating(true);
        setStatus('Initiating Secure Handshake...');

        setTimeout(() => setStatus('Verifying Biometrics...'), 800);
        setTimeout(() => setStatus('Exchanging Cryptographic Keys...'), 1600);
        setTimeout(() => setStatus('Granting Clearance...'), 2400);

        setTimeout(() => {
            onLogin();
        }, 3000);
    };

    return (
        <div className="relative w-screen h-screen bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
            {/* Background Map Simulation Overlay */}
            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            {/* Radar Sweep Effect */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/5 rounded-full border border-emerald-500/10 pointer-events-none animate-[pulse_4s_infinite]"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-emerald-500/10 rounded-full flex items-center justify-center pointer-events-none">
                <div className="w-[400px] h-[400px] border border-emerald-500/10 rounded-full"></div>
            </div>

            {/* Login Card */}
            <div className="z-10 w-full max-w-md p-8 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
                {/* Top decorative bar */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent"></div>

                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase drop-shadow-md">OmniSight</h1>
                    <p className="text-[10px] font-mono text-emerald-400/80 uppercase tracking-[0.3em] mt-2">Tactical Operations Center</p>
                </div>

                <div className="space-y-6">
                    <div className="border-l-2 border-red-500/50 pl-3 py-1 bg-red-500/5 rounded-r">
                        <p className="text-[9px] font-mono text-white/50 uppercase tracking-widest leading-relaxed">
                            <span className="text-red-400 font-bold">WARNING:</span> UNAUTHORIZED ACCESS IS STRICTLY PROHIBITED AND MONITORED.
                        </p>
                    </div>

                    {!isAuthenticating ? (
                        <button
                            onClick={handleSSO}
                            className="w-full relative group overflow-hidden bg-white/5 hover:bg-white/10 border border-white/10 p-4 rounded-xl flex items-center justify-center gap-3 transition-all duration-300"
                        >
                            <div className="absolute inset-0 w-1 bg-emerald-500 transition-all duration-300 group-hover:w-full opacity-10"></div>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white group-hover:text-emerald-400 transition-colors relative z-10">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            <span className="font-mono text-sm font-bold text-white uppercase tracking-widest relative z-10 group-hover:text-emerald-400 transition-colors">
                                Authenticate via SSO
                            </span>
                        </button>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-4 space-y-4">
                            <div className="relative w-12 h-12">
                                <svg className="animate-spin text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></div>
                                </div>
                            </div>
                            <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest animate-pulse text-center">
                                {status}
                            </span>
                        </div>
                    )}
                </div>

                <div className="mt-8 pt-4 border-t border-white/10 flex justify-between items-center text-[8px] font-mono text-white/30 uppercase tracking-[0.2em]">
                    <span>Node: ALPHA-7</span>
                    <span>System v2.4.1</span>
                </div>
            </div>
        </div>
    );
};

export default Login;
