import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

export interface Claim {
    id: string;
    text: string;
    timestamp?: string;
    status: 'true' | 'false' | 'partially_true' | 'unverifiable';
    score: number;
    explanation: string;
    wrongPart?: string;
    correction?: string;
    sources?: string[];
}

export interface VideoJob {
    id: string;
    status: 'pending' | 'downloading' | 'transcribing' | 'analyzing' | 'completed' | 'error';
    progress: number;
    statusMessage: string;
    transcription?: string;
    title?: string;
    platform?: string;
    overallScore?: number;
    claims?: Claim[];
    error?: string;
}

export async function startProcessing(url: string, language: string): Promise<{ id: string }> {
    const res = await axios.post(`${API_BASE}/video/process`, { url, language });
    return res.data;
}

export async function getStatus(id: string): Promise<VideoJob> {
    const res = await axios.get(`${API_BASE}/video/${id}/status`);
    return res.data;
}

export async function startAnalysis(id: string): Promise<void> {
    await axios.post(`${API_BASE}/video/${id}/analyze`, { useInternet: true });
}

export async function getResults(id: string): Promise<VideoJob> {
    const res = await axios.get(`${API_BASE}/video/${id}/results`);
    return res.data;
}

export async function getLanguages(): Promise<{ code: string; name: string; nativeName: string }[]> {
    const res = await axios.get(`${API_BASE}/languages`);
    return res.data;
}
