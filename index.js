
const express = require('express')
const multer = require('multer')
const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const {GoogleGenAI} = require('@google/genai');
require('dotenv').config();

const app = express();
const upload = multer({dest: "uploads/"});

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

// Generate embedding for a text chunk
async function createEmbedding(text) {
    const response = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: text,
        config: {
            taskType: 'RETRIEVAL_DOCUMENT'
        }
    });

    return response.embeddings[0].values;
}

function cosineSimilarity(vecA,vectB)
{
    let dotProduct =0;
     
}

  

app.get('/', (req, res) => {
    res.send('hey i am raushan')
});

app.post('/upload', upload.single("pdf"), async (req, res) => {
    console.log(req.body);
    try {
        if (!req.file) {
            return res.status(400).send("Please upload a PDF file");
        }

      const dataBuffer = fs.readFileSync(req.file.path);

        const parser = new PDFParse({
            data: dataBuffer
        });

        let text;

        try {
            const pdfData = await parser.getText();
            text = pdfData.text;
        } finally {
            await parser.destroy();
        }

        console.log("Extracted PDF text:", text);

         // Split PDF text into non-empty paragraph chunks
        const chunks = text
            .split(/\n\s*\n/)
            .map(chunk => chunk.trim())
            .filter(chunk => chunk.length > 0);

        if (chunks.length === 0) {
            return res.status(400).send('No readable text found in PDF');
        }
 
        
       
        console.log(embedding);

        // store all existing chunks into vector db (arry) store text , embdding 
             // Generate embedding for the chunk await createEmbedding(chunks
        const chunkEmbeddings=[];
        for(const chunk of chunks)
        {
             const embedding=await createEmbedding(chunks[0]);

             chunkEmbeddings.push({
                text:chunk,
                embedding
             });
        }

        // Select a chunk for the question-answering demo
        const question = req.body.question || 'Summarize this PDF';

       // Basic keyword matching; not semantic similarity
        const keywords = question
            .toLowerCase()
            .replace(/[?!.,]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 2);

        // const matchedChunk =
        //     chunks.find(chunk =>
        //         keywords.some(word => chunk.toLowerCase().includes(word))
        //     ) || chunks[0];

        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: `Answer the question using this context.

        Context: ${matchedChunk}

        Question: ${question}`
        });

              // Return the embedding and other results to Postman
       res.json({
            totalChunks: chunks.length,
            firstChunk: chunks[0],
            embeddingDimension: embedding.length,
            embedding: embedding,
            matchedChunk: matchedChunk,
            answer: response.text
        });

    } catch (error) {
        console.error(error);
        res.status(500).send(error.message);
    }
});

app.listen(3000, () => {
    console.log('server is running on port 3000')
});
