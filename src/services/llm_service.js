import { GoogleGenAI } from '@google/genai';
import { CohereClient } from 'cohere-ai'; 

const LLM_CLIENT = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY 
});

const COHERE_CLIENT = new CohereClient({
    token: process.env.COHERE_API_KEY, 
});

const generateEmbedding = async (text) => {
    try {
        const response = await LLM_CLIENT.models.embedContent({ 
            model: 'text-embedding-004', 
            contents: [
                { role: "user", parts: [{ text: text }] }
            ],
        });
        return response.embeddings[0].values; 

    } catch (error) {
        console.error("Error generating embedding:", error.message);
        throw error;
    }
};

const reRankChunks = async (question, candidateChunks) => {
    const TOP_N = 4; 
    
    const documents = candidateChunks.map(chunk => chunk.text_chunk); 

    try {
        const response = await COHERE_CLIENT.rerank({
            model: "rerank-english-v3.0", 
            query: question,
            documents: documents,
            topN: TOP_N, 
        });

        const finalContext = response.results
            .map(result => ({
                ...candidateChunks[result.index], 
                relevance_score: result.relevance_score, 
            }));
            
        console.log(`\nRe-ranker: Cohere Cross-Encoder filtered ${candidateChunks.length} candidates down to ${finalContext.length} best chunks.`);
        
        return finalContext;

    } catch (error) {
        console.error("COHERE RERANKING FAILED:", error.message);
        throw new Error("Reranking failed. Check Cohere API setup.");
    }
};


const generateFinalAnswer = async (question, finalContext) => {
    const contextTexts = finalContext.map(chunk => chunk.text_chunk); 
    const retrievedContextString = contextTexts.join('\n\n--- Source Chunk ---\n\n');

    const SYSTEM_INSTRUCTION = 
        `You are a highly analytical and factual AI assistant. Your primary task is to act as a summarizer.
        
        RULES:
        1. **STRICT GROUNDING:** You MUST use ONLY the facts provided in the CONTEXT section to answer the question.
        2. **NO HALLUCINATION:** Do not use any external knowledge.
        3. **NEGATIVE CONSTRAINT:** If the CONTEXT does not contain sufficient information to answer the question, you MUST respond ONLY with the exact phrase: "The requested information is not available in the source documents."
        4. **FORMAT:** Answer concisely and directly.`;
    
    const finalPrompt = 
        `--- BEGIN PROMPT ---\n\n` +
        `SYSTEM INSTRUCTION:\n${SYSTEM_INSTRUCTION}\n\n` +
        `CONTEXT:\n${retrievedContextString}\n\n` + 
        `USER QUESTION: ${question}\n\n` +
        `--- END PROMPT ---`;

    try {
        const response = await LLM_CLIENT.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: "user", parts: [{ text: finalPrompt }] }], 
        });
        return response.text;
    } catch (error) {
        console.error("LLM Generation Failed:", error.message);
        throw new Error("LLM generation API call failed.");
    }
};

export {
    generateEmbedding,
    reRankChunks,
    generateFinalAnswer,
};
