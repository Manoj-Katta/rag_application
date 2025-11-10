import * as llmService from '../services/llm_service.js';
import * as vectorService from '../services/vector_service.js'

const answerQuestion = async (req, res) => {
    try {
        const question = req.body.query;
        const queryVector = await llmService.generateEmbedding(question);
        const candidateChunks = await vectorService.searchChunks(queryVector, 20);
        const finalContext = await llmService.reRankChunks(question, candidateChunks);
        const finalAnswer = await llmService.generateFinalAnswer(question, finalContext);
        res.json({
            answer: finalAnswer,
            final_chunks: finalContext,        
            candidate_chunks: candidateChunks, 
        });
    } catch (error) {
        console.error("RAG Pipeline Failed:", error);
        
        res.status(500).json({ 
            error: "An internal server error occurred while processing the RAG pipeline.",
            details: error.message 
        });
    }
};

export {
    answerQuestion
};
