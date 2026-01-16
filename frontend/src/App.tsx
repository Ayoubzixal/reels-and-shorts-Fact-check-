import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from './api';

type AppState =
    | { phase: 'input' }
    | { phase: 'processing'; job: api.VideoJob }
    | { phase: 'ready_to_analyze'; job: api.VideoJob }
    | { phase: 'analyzing'; job: api.VideoJob }
    | { phase: 'results'; job: api.VideoJob }
    | { phase: 'error'; message: string };

// ClaimCard component with improved design
function ClaimCard({ claim }: { claim: api.Claim }) {
    const statusConfig = {
        'true': {
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/30',
            badge: 'bg-emerald-500',
            icon: '✓',
            label: 'TRUE'
        },
        'false': {
            bg: 'bg-red-500/10',
            border: 'border-red-500/30',
            badge: 'bg-red-500',
            icon: '✗',
            label: 'FALSE'
        },
        'partially_true': {
            bg: 'bg-amber-500/10',
            border: 'border-amber-500/30',
            badge: 'bg-amber-500',
            icon: '⚠',
            label: 'MISLEADING'
        },
        'unverifiable': {
            bg: 'bg-zinc-500/10',
            border: 'border-zinc-600',
            badge: 'bg-zinc-500',
            icon: '?',
            label: 'UNVERIFIED'
        }
    }[claim.status];

    return (
        <div className={`${statusConfig.bg} border ${statusConfig.border} rounded-xl overflow-hidden`}>
            {/* Header */}
            <div className="p-4 border-b border-zinc-800/50">
                <div className="flex items-start gap-3">
                    <span className={`${statusConfig.badge} text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0`}>
                        {statusConfig.icon}
                    </span>
                    <div className="flex-1">
                        <p className="text-white font-medium leading-relaxed">"{claim.text}"</p>
                        <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-bold ${statusConfig.badge} text-white`}>
                            {statusConfig.label}
                        </span>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
                {/* Explanation */}
                <p className="text-zinc-300 text-sm">{claim.explanation}</p>

                {/* Wrong Part - for false/misleading claims */}
                {claim.wrongPart && (
                    <div className="bg-red-950/50 border border-red-500/20 rounded-lg p-3">
                        <p className="text-xs text-red-400 font-semibold uppercase mb-1">❌ What's Wrong</p>
                        <p className="text-red-200 text-sm">"{claim.wrongPart}"</p>
                    </div>
                )}

                {/* Correction */}
                {claim.correction && (
                    <div className="bg-emerald-950/50 border border-emerald-500/20 rounded-lg p-3">
                        <p className="text-xs text-emerald-400 font-semibold uppercase mb-1">✓ Correct Information</p>
                        <p className="text-emerald-200 text-sm">{claim.correction}</p>
                    </div>
                )}

                {/* Sources */}
                {claim.sources && claim.sources.length > 0 && (
                    <div className="pt-3 border-t border-zinc-800">
                        <p className="text-xs text-zinc-500 font-semibold uppercase mb-2">📚 Sources</p>
                        <div className="flex flex-wrap gap-2">
                            {claim.sources.map((source, idx) => {
                                const isUrl = source.startsWith('http');
                                if (isUrl) {
                                    try {
                                        const hostname = new URL(source).hostname.replace('www.', '');
                                        return (
                                            <a
                                                key={idx}
                                                href={source}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-3 py-1.5 rounded-lg transition-colors"
                                            >
                                                🔗 {hostname}
                                            </a>
                                        );
                                    } catch {
                                        return (
                                            <span key={idx} className="text-xs bg-zinc-800 text-zinc-400 px-3 py-1.5 rounded-lg">
                                                {source}
                                            </span>
                                        );
                                    }
                                }
                                return (
                                    <span key={idx} className="text-xs bg-zinc-800 text-zinc-400 px-3 py-1.5 rounded-lg">
                                        📄 {source}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function App() {
    const [state, setState] = useState<AppState>({ phase: 'input' });
    const [url, setUrl] = useState('');
    const [language, setLanguage] = useState('en');
    const [languages, setLanguages] = useState<{ code: string; name: string; nativeName: string }[]>([]);
    const pollRef = useRef<number | null>(null);
    const isAnalyzingRef = useRef(false); // Track if we're in analysis mode

    // Load languages on mount
    useEffect(() => {
        api.getLanguages().then(setLanguages).catch(console.error);
    }, []);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    const stopPolling = () => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    };

    const pollStatus = useCallback((jobId: string) => {
        stopPolling();

        pollRef.current = window.setInterval(async () => {
            try {
                const job = await api.getStatus(jobId);
                console.log('Poll result:', job.status, 'isAnalyzing:', isAnalyzingRef.current);

                if (job.status === 'error') {
                    stopPolling();
                    setState({ phase: 'error', message: job.error || 'Unknown error' });
                    return;
                }

                if (job.status === 'completed') {
                    stopPolling();

                    // If we were analyzing, get full results
                    if (isAnalyzingRef.current) {
                        try {
                            const results = await api.getResults(jobId);
                            isAnalyzingRef.current = false;
                            setState({ phase: 'results', job: results });
                        } catch (err) {
                            console.error('Failed to get results:', err);
                            isAnalyzingRef.current = false;
                            setState({ phase: 'error', message: 'Failed to get analysis results' });
                        }
                    } else {
                        // Transcription done, ready for analysis
                        setState({ phase: 'ready_to_analyze', job });
                    }
                    return;
                }

                // Still processing - update UI
                if (isAnalyzingRef.current) {
                    setState({ phase: 'analyzing', job });
                } else {
                    setState({ phase: 'processing', job });
                }
            } catch (err) {
                console.error('Poll error:', err);
            }
        }, 2000);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url.trim()) return;

        try {
            isAnalyzingRef.current = false;
            const { id } = await api.startProcessing(url, language);
            setState({
                phase: 'processing',
                job: {
                    id,
                    status: 'pending',
                    progress: 0,
                    statusMessage: 'Starting...'
                }
            });
            pollStatus(id);
        } catch (err: any) {
            setState({ phase: 'error', message: err.message || 'Failed to start processing' });
        }
    };

    const handleAnalyze = async () => {
        if (state.phase !== 'ready_to_analyze') return;

        try {
            isAnalyzingRef.current = true; // Mark that we're now analyzing
            await api.startAnalysis(state.job.id);
            setState({ phase: 'analyzing', job: { ...state.job, status: 'analyzing', statusMessage: 'Analyzing claims...', progress: 75 } });
            pollStatus(state.job.id);
        } catch (err: any) {
            isAnalyzingRef.current = false;
            setState({ phase: 'error', message: err.message || 'Failed to start analysis' });
        }
    };

    const handleReset = () => {
        if (pollRef.current) clearInterval(pollRef.current);
        setState({ phase: 'input' });
        setUrl('');
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-white p-6 md:p-8">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium mb-4">
                        ✓ AI-Powered Verification
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                        Video Fact Checker
                    </h1>
                    <p className="text-zinc-400 text-lg">
                        Analyze videos for misinformation using Gemini AI
                    </p>
                </div>

                {/* Input Phase */}
                {state.phase === 'input' && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 md:p-8">
                        {/* Supported Platforms */}
                        <div className="flex flex-wrap justify-center gap-4 mb-8">
                            {['YouTube', 'TikTok', 'Instagram', 'X/Twitter', 'Facebook'].map(platform => (
                                <span key={platform} className="px-3 py-1.5 bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-400 text-sm">
                                    {platform}
                                </span>
                            ))}
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* URL Input */}
                            <div>
                                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                                    Video URL
                                </label>
                                <div className="relative">
                                    <input
                                        type="url"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        placeholder="https://..."
                                        className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-5 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 placeholder-zinc-500"
                                        required
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">
                                        🔗
                                    </span>
                                </div>
                            </div>

                            {/* Language Select */}
                            <div>
                                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                                    Response Language
                                </label>
                                <select
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none cursor-pointer"
                                >
                                    {languages.length > 0 ? (
                                        languages.map((lang) => (
                                            <option key={lang.code} value={lang.code}>
                                                {lang.nativeName} ({lang.name})
                                            </option>
                                        ))
                                    ) : (
                                        <>
                                            <option value="en">English</option>
                                            <option value="ar">العربية (Arabic)</option>
                                            <option value="fr">Français (French)</option>
                                        </>
                                    )}
                                </select>
                                <p className="text-xs text-zinc-500 mt-2">
                                    Results will be displayed in the selected language
                                </p>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold py-4 rounded-xl transition-all text-lg shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
                            >
                                🔍 Analyze Video
                            </button>
                        </form>

                        {/* How it works */}
                        <div className="mt-8 pt-6 border-t border-zinc-800">
                            <p className="text-center text-zinc-500 text-sm mb-4">How it works</p>
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                                        <span className="text-blue-400">1</span>
                                    </div>
                                    <p className="text-xs text-zinc-400">Download & Transcribe</p>
                                </div>
                                <div>
                                    <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                                        <span className="text-purple-400">2</span>
                                    </div>
                                    <p className="text-xs text-zinc-400">Extract Claims</p>
                                </div>
                                <div>
                                    <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                                        <span className="text-emerald-400">3</span>
                                    </div>
                                    <p className="text-xs text-zinc-400">Verify Facts</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Processing Phase */}
                {(state.phase === 'processing' || state.phase === 'analyzing') && (
                    <div className="text-center py-20">
                        <div className="inline-flex items-center gap-3 px-6 py-3 bg-zinc-900/50 rounded-full border border-zinc-800 mb-8">
                            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                            <span className="text-zinc-400 uppercase text-sm tracking-wider">
                                {state.phase === 'analyzing' ? 'Analyzing' : 'Processing'}
                            </span>
                        </div>

                        <h2 className="text-2xl font-bold mb-4">{state.job.statusMessage}</h2>

                        <div className="w-full max-w-md mx-auto bg-zinc-900 rounded-full h-3 overflow-hidden mb-4">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-500"
                                style={{ width: `${state.job.progress}%` }}
                            />
                        </div>

                        <p className="text-zinc-500">{state.job.progress}% complete</p>
                    </div>
                )}

                {/* Ready to Analyze Phase */}
                {state.phase === 'ready_to_analyze' && (
                    <div className="space-y-8">
                        <div className="text-center">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-full text-sm mb-4">
                                ✓ Transcription Complete
                            </div>
                            <h2 className="text-2xl font-bold">{state.job.title || 'Video Ready'}</h2>
                        </div>

                        {state.job.transcription && (
                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                                <h3 className="font-semibold text-zinc-400 mb-3">Transcription</h3>
                                <p className="text-zinc-300 whitespace-pre-wrap max-h-60 overflow-y-auto text-sm leading-relaxed">
                                    {state.job.transcription}
                                </p>
                            </div>
                        )}

                        <button
                            onClick={handleAnalyze}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 rounded-xl transition-colors text-lg"
                        >
                            Start Fact-Check Analysis
                        </button>
                    </div>
                )}

                {/* Results Phase - New Two Column Layout */}
                {state.phase === 'results' && state.job.claims && (() => {
                    const trueClaims = state.job.claims.filter(c => c.status === 'true');
                    const falseClaims = state.job.claims.filter(c => c.status === 'false');
                    const misleadingClaims = state.job.claims.filter(c => c.status === 'partially_true');
                    const problemClaims = [...falseClaims, ...misleadingClaims];

                    // Collect sources ONLY from wrong/misleading claims
                    const allSources = problemClaims
                        .flatMap(c => c.sources || [])
                        .filter((s, i, arr) => arr.indexOf(s) === i); // unique only

                    return (
                        <div className="space-y-6">
                            {/* Score Card */}
                            <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-20 h-20 rounded-full flex items-center justify-center border-4 ${(state.job.overallScore ?? 0) >= 70 ? 'border-emerald-500 bg-emerald-500/10' :
                                            (state.job.overallScore ?? 0) >= 40 ? 'border-amber-500 bg-amber-500/10' :
                                                'border-red-500 bg-red-500/10'
                                            }`}>
                                            <span className={`text-2xl font-bold ${(state.job.overallScore ?? 0) >= 70 ? 'text-emerald-400' :
                                                (state.job.overallScore ?? 0) >= 40 ? 'text-amber-400' :
                                                    'text-red-400'
                                                }`}>
                                                {state.job.overallScore}%
                                            </span>
                                        </div>
                                        <div>
                                            <h2 className={`text-xl font-bold ${(state.job.overallScore ?? 0) >= 70 ? 'text-emerald-400' :
                                                (state.job.overallScore ?? 0) >= 40 ? 'text-amber-400' :
                                                    'text-red-400'
                                                }`}>
                                                {(state.job.overallScore ?? 0) >= 70 ? '✓ Mostly Accurate' :
                                                    (state.job.overallScore ?? 0) >= 40 ? '⚠ Mixed Accuracy' :
                                                        '✗ Low Credibility'}
                                            </h2>
                                            <p className="text-zinc-500 text-sm">{state.job.claims.length} claims analyzed</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-medium">
                                            {trueClaims.length} True
                                        </span>
                                        <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium">
                                            {falseClaims.length} False
                                        </span>
                                        <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm font-medium">
                                            {misleadingClaims.length} Misleading
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Two Column Layout */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* LEFT: Wrong & Misleading Claims */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-bold text-red-400 border-b border-red-500/20 pb-2">
                                        ✗ Issues Found ({problemClaims.length})
                                    </h3>
                                    {problemClaims.length === 0 ? (
                                        <p className="text-zinc-500 text-sm py-4">No false or misleading claims detected!</p>
                                    ) : (
                                        problemClaims.map((claim) => (
                                            <div key={claim.id} className={`border rounded-xl p-4 ${claim.status === 'false' ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'
                                                }`}>
                                                <div className="flex items-start gap-2 mb-3">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${claim.status === 'false' ? 'bg-red-500 text-white' : 'bg-amber-500 text-black'
                                                        }`}>
                                                        {claim.status === 'false' ? 'FALSE' : 'MISLEADING'}
                                                    </span>
                                                </div>
                                                <p className="text-white text-sm mb-3">"{claim.text}"</p>

                                                {claim.wrongPart && (
                                                    <div className="bg-red-950/30 rounded-lg p-3 mb-2">
                                                        <p className="text-xs text-red-400 font-semibold mb-1">❌ Wrong:</p>
                                                        <p className="text-red-200 text-sm">"{claim.wrongPart}"</p>
                                                    </div>
                                                )}

                                                {claim.correction && (
                                                    <div className="bg-emerald-950/30 rounded-lg p-3">
                                                        <p className="text-xs text-emerald-400 font-semibold mb-1">✓ Correct:</p>
                                                        <p className="text-emerald-200 text-sm">{claim.correction}</p>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* RIGHT: Correct Claims */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-bold text-emerald-400 border-b border-emerald-500/20 pb-2">
                                        ✓ Verified True ({trueClaims.length})
                                    </h3>
                                    {trueClaims.length === 0 ? (
                                        <p className="text-zinc-500 text-sm py-4">No verified true claims found.</p>
                                    ) : (
                                        trueClaims.map((claim) => (
                                            <div key={claim.id} className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                                                <div className="flex items-start gap-2">
                                                    <span className="text-emerald-400 mt-0.5">✓</span>
                                                    <p className="text-white text-sm">"{claim.text}"</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Sources Section at Bottom */}
                            {allSources.length > 0 && (
                                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
                                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">
                                        📚 Sources ({allSources.length})
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {allSources.map((source, idx) => {
                                            const isUrl = source.startsWith('http');
                                            if (isUrl) {
                                                try {
                                                    const hostname = new URL(source).hostname.replace('www.', '');
                                                    return (
                                                        <a
                                                            key={idx}
                                                            href={source}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-sm bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg transition-colors"
                                                        >
                                                            🔗 {hostname}
                                                        </a>
                                                    );
                                                } catch {
                                                    return <span key={idx} className="text-sm bg-zinc-800 text-zinc-400 px-3 py-1.5 rounded-lg">{source}</span>;
                                                }
                                            }
                                            return (
                                                <span key={idx} className="text-sm bg-zinc-800 text-zinc-400 px-3 py-1.5 rounded-lg">
                                                    📄 {source}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleReset}
                                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-4 rounded-xl transition-colors"
                            >
                                Analyze Another Video
                            </button>
                        </div>
                    );
                })()}

                {/* Error Phase */}
                {state.phase === 'error' && (
                    <div className="text-center py-20">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full mb-6">
                            <span className="text-3xl">❌</span>
                        </div>
                        <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
                        <p className="text-zinc-400 mb-8">{state.message}</p>
                        <button
                            onClick={handleReset}
                            className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
