// Video processing status
export type VideoStatus = 'pending' | 'downloading' | 'transcribing' | 'analyzing' | 'completed' | 'error';

// Claim verification status
export type ClaimStatus = 'true' | 'false' | 'partially_true' | 'unverifiable';

// Claim interface
export interface Claim {
    id: string;
    text: string;
    timestamp?: string;
    status: ClaimStatus;
    score: number; // 0-100
    explanation: string;
    wrongPart?: string;
    correction?: string;
    sources?: string[];
}

// Video data interface
export interface VideoData {
    id: string;
    url: string;
    platform: string;
    title?: string;
    duration?: number;
    language: string;
    status: VideoStatus;
    progress: number;
    statusMessage: string;
    audioPath?: string;
    transcription?: string;
    claims?: Claim[];
    overallScore?: number;
    analyzedAt?: Date;
    createdAt: Date;
    error?: string;
}

// API Request/Response interfaces
export interface ProcessVideoRequest {
    url: string;
    language: string;
}

export interface ProcessVideoResponse {
    id: string;
    message: string;
}

export interface VideoStatusResponse {
    id: string;
    status: VideoStatus;
    progress: number;
    statusMessage: string;
    transcription?: string;
}

export interface AnalyzeRequest {
    useInternet?: boolean;
}

export interface FactCheckResult {
    claims: Claim[];
    overallScore: number;
    summary: {
        totalClaims: number;
        trueClaims: number;
        falseClaims: number;
        partiallyTrueClaims: number;
        unverifiableClaims: number;
    };
}

export interface VideoResultResponse {
    id: string;
    url: string;
    title?: string;
    language: string;
    transcription: string;
    overallScore: number;
    claims: Claim[];
    summary: {
        totalClaims: number;
        trueClaims: number;
        falseClaims: number;
        partiallyTrueClaims: number;
        unverifiableClaims: number;
    };
}

export interface LanguageOption {
    code: string;
    name: string;
    nativeName: string;
}
