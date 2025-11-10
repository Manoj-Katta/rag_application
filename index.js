import 'dotenv/config'; 
import express from 'express';
import { answerQuestion } from './src/controllers/rag_controller.js'; 

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); 
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

app.use(express.json());


app.get('/', (req, res) => {
    res.status(200).send("RAG Server is running. Use the /answer route to query.");
});

app.post('/answer', answerQuestion);

app.listen(PORT, () => {
    console.log(`Server is Successfully Running on port ${PORT}`);
    console.log(`API Endpoint: http://localhost:${PORT}/answer`);
});
