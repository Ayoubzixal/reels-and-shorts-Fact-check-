import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/config';
import { Claim, ClaimStatus, FactCheckResult } from '../types';
import { generateId } from '../utils/helpers';

/**
 * Extract claims and fact-check them using Gemini AI
 */
export async function factCheckTranscription(
    transcription: string,
    language: string = 'English',
    onProgress?: (progress: number, message: string) => void
): Promise<FactCheckResult> {
    if (!config.geminiApiKey) {
        throw new Error('Gemini API key not configured');
    }

    onProgress?.(75, 'Extracting claims from transcription...');

    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const model = genAI.getGenerativeModel({ model: config.geminiAnalysisModel });

    // Get language name from config
    const languageInfo = config.supportedLanguages.find(l => l.code === language);
    const languageName = languageInfo?.name || 'English';

    // Step 1: Extract claims
    const extractionPrompt = `You are a fact-checking expert. Analyze the following transcription and extract all factual claims that can be verified.

TRANSCRIPTION:
${transcription}

INSTRUCTIONS:
1. Extract ONLY factual claims (statements that can be verified as true or false)
2. Skip opinions, questions, and subjective statements
3. Include the approximate timestamp if available
4. Return the claims in JSON format
5. IMPORTANT: Write ALL text in ${languageName}

Return a JSON array with this structure:
[
  {
    "text": "The factual claim text in ${languageName}",
    "timestamp": "MM:SS or null if not available"
  }
]

Return ONLY the JSON array, no additional text:`;

    try {
        const extractionResult = await model.generateContent(extractionPrompt);
        const extractionText = extractionResult.response.text();

        // Parse extracted claims
        let extractedClaims: Array<{ text: string; timestamp?: string }> = [];

        try {
            // Clean up the response - remove markdown code blocks if present
            let cleanJson = extractionText.trim();
            if (cleanJson.startsWith('```json')) {
                cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanJson.startsWith('```')) {
                cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            extractedClaims = JSON.parse(cleanJson);
        } catch {
            // If parsing fails, create a single claim from the transcription
            extractedClaims = [{ text: 'Unable to extract specific claims', timestamp: undefined }];
        }

        if (extractedClaims.length === 0) {
            return {
                claims: [],
                overallScore: 100,
                summary: {
                    totalClaims: 0,
                    trueClaims: 0,
                    falseClaims: 0,
                    partiallyTrueClaims: 0,
                    unverifiableClaims: 0,
                },
            };
        }

        onProgress?.(80, `Fact-checking ${extractedClaims.length} claims...`);

        // Step 2: Fact-check each claim
        const factCheckPrompt = `You are an expert fact-checker. Verify each claim and provide clear, helpful feedback.

IMPORTANT: Write ALL your responses in ${languageName}.

CLAIMS TO VERIFY:
${JSON.stringify(extractedClaims, null, 2)}

For each claim, analyze and return:

1. **status**: "true", "false", "partially_true", or "unverifiable"

2. **score**: 0-100 accuracy score

3. **explanation**: Simple, clear explanation in ${languageName}

4. **wrongPart**: (ONLY if false/partially_true) Quote the EXACT part that is wrong

5. **correction**: (ONLY if false/partially_true) The correct information in ${languageName}

6. **sources**: (ONLY if false/partially_true) Provide 1-3 VERIFIED sources that prove the claim is wrong. Use trusted sources:
   - Wikipedia (e.g., https://en.wikipedia.org/wiki/Topic)
   - Reuters, BBC, AP News, official .gov sites
   - For TRUE claims, leave sources as empty array []

Return JSON array:
[
  {
    "claimIndex": 0,
    "status": "true|false|partially_true|unverifiable",
    "score": 85,
    "explanation": "Explanation in ${languageName}",
    "wrongPart": "The incorrect part" or null,
    "correction": "Correct info in ${languageName}" or null,
    "sources": ["https://verified-source.com"] // only for false/partially_true
  }
]

Return ONLY valid JSON, no markdown:`;

        const factCheckResult = await model.generateContent(factCheckPrompt);
        const factCheckText = factCheckResult.response.text();

        let factCheckData: Array<{
            claimIndex: number;
            status: string;
            score: number;
            explanation: string;
            wrongPart?: string;
            correction?: string;
            sources?: string[];
        }> = [];

        try {
            let cleanJson = factCheckText.trim();
            if (cleanJson.startsWith('```json')) {
                cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanJson.startsWith('```')) {
                cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            factCheckData = JSON.parse(cleanJson);
        } catch {
            // If parsing fails, mark all as unverifiable
            factCheckData = extractedClaims.map((_, index) => ({
                claimIndex: index,
                status: 'unverifiable',
                score: 50,
                explanation: 'Unable to verify this claim',
                wrongPart: undefined,
                correction: undefined,
                sources: [],
            }));
        }

        onProgress?.(90, 'Calculating final scores...');

        // Build final claims array
        const claims: Claim[] = extractedClaims.map((claim, index) => {
            const checkResult = factCheckData.find(f => f.claimIndex === index) || {
                status: 'unverifiable',
                score: 50,
                explanation: 'Unable to verify',
                wrongPart: undefined,
                correction: undefined,
                sources: [],
            };

            return {
                id: generateId(),
                text: claim.text,
                timestamp: claim.timestamp,
                status: checkResult.status as ClaimStatus,
                score: checkResult.score,
                explanation: checkResult.explanation,
                wrongPart: checkResult.wrongPart,
                correction: checkResult.correction,
                // Ensure sources are empty for true claims (UI requirement)
                sources: checkResult.status === 'true' ? [] : (checkResult.sources || []),
            };
        });

        // Calculate summary
        const summary = {
            totalClaims: claims.length,
            trueClaims: claims.filter(c => c.status === 'true').length,
            falseClaims: claims.filter(c => c.status === 'false').length,
            partiallyTrueClaims: claims.filter(c => c.status === 'partially_true').length,
            unverifiableClaims: claims.filter(c => c.status === 'unverifiable').length,
        };

        // Calculate overall score - weighted by claim status and linked to total claims
        // True = 100 points, Partially True = 50 points, Unverifiable = 50 points, False = 0 points
        // Final score = (weighted sum) / total claims * 100
        const { totalClaims, trueClaims, partiallyTrueClaims, unverifiableClaims, falseClaims } = summary;

        let overallScore: number;
        if (totalClaims === 0) {
            overallScore = 100; // No claims means nothing to fact-check
        } else {
            // Calculate weighted score based on claim counts
            const weightedSum =
                (trueClaims * 100) +           // True claims = full credit
                (partiallyTrueClaims * 50) +   // Partially true = half credit
                (unverifiableClaims * 50) +    // Unverifiable = neutral (half credit)
                (falseClaims * 0);              // False claims = no credit

            overallScore = Math.round(weightedSum / totalClaims);
        }

        onProgress?.(100, 'Analysis complete!');

        return {
            claims,
            overallScore,
            summary,
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Fact-checking failed: ${errorMessage}`);
    }
}
