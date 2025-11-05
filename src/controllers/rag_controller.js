import * as llmService from '../services/llm_service.js';
import * as vectorService from '../services/vector_service.js'

const answerQuestion = async (req, res) => {
    try {
        const question = req.body.query;
        console.log(`question:\n\n ${question}\n\n`);
        const queryVector = await llmService.generateEmbedding(question);
        console.log(`queryVector: ${queryVector}\n\n`);
        const candidateChunks = await vectorService.searchChunks(queryVector, 20);
        console.log(`candidateChunks: ${JSON.stringify(candidateChunks)}\n\n`);
        const finalContext = await llmService.reRankChunks(question, candidateChunks);
        console.log(`finalContext: ${JSON.stringify(finalContext)}\n\n`);
        const finalAnswer = await llmService.generateFinalAnswer(question, finalContext);
        console.log(`finalAnswer: ${finalAnswer}`);
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
