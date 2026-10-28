
const express = require('express')
const multer = require('multer')
const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const {GoogleGenAI} = require('@google/genai');
const {QdrantClient} = require('@qdrant/js-client-rest');
require('dotenv').config();

const app = express();
const upload = multer({dest: "uploads/"});

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

// Generate embedding for a text chunk

async function createEmbedding(text, taskType = 'RETRIEVAL_DOCUMENT') {
    const response = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: text,
        config: {
            taskType
        }
    });

    return response.embeddings[0].values;
}


// close search similarity return ( embedding)
// function cosineSimilarity(vecA,vectB)
// {
//     let dotProduct =0;
//     for(let i=0;i<vecA.length;i++)
//     {
//         dotProduct+=vecA[i]*vectB[i];
//     }
//     return dotProduct;
     
// }

const qdrant = new QdrantClient({
     url: process.env.QDRANT_URL,
    apiKey:process.env.QDRANT_API_KEY 
});

// function cosineSimilarity(vecA, vectB) {
//     if (vecA.length !== vectB.length) {
//         throw new Error("Vector size mismatch");
//     }

//     let dotProduct = 0;
//     let magnitudeA = 0;
//     let magnitudeB = 0;

//     for (let i = 0; i < vecA.length; i++) {
//         dotProduct += vecA[i] * vectB[i];
//         magnitudeA += vecA[i] * vecA[i];
//         magnitudeB += vectB[i] * vectB[i];
//     }

//     if (magnitudeA === 0 || magnitudeB === 0) {
//         throw new Error("Cannot compare zero vectors");
//     }

//     return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
// }

 // collection create krne k ly --> VDB , schema
app.get('/create-collection', async (req, res) => {
    try {
        const collectionName = 'pdf-docs';

        const exists = await qdrant.collectionExists(collectionName);

        if (exists.exists) {
            return res.send('Collection already exists');
        }

        await qdrant.createCollection(collectionName, {
            vectors: {
                size: 3072,
                distance: 'Cosine',
            },
        });

        res.send('Collection created successfully');
    } catch (error) {
        console.error(error);
        res.status(500).send(error.message);
    }
});


  

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

        // console.log("Extracted PDF text:", text);

         // Split PDF text into non-empty paragraph chunks
     
        const cleanText = text.replace(/\s+/g, ' ').trim();

        const chunkSize = 1000;
        const chunks = [];

        for (let i = 0; i < cleanText.length; i += chunkSize) {
            chunks.push(cleanText.slice(i, i + chunkSize));
        }


        if (chunks.length === 0) {
            return res.status(400).send('No readable text found in PDF');
        }
 
     

        // store all existing chunks into vector db (arry) store text , embdding 
             // Generate embedding for the chunk await createEmbedding(chunks
        const chunkEmbeddings=[];
        for(const chunk of chunks)
        {
             const embedding=await createEmbedding(chunk);

             chunkEmbeddings.push({
                text:chunk,
                embedding
             });
        }

           // send data to qdrant V =DB , id (unqiue id) , emdedding as vector and chuck as payload
        const points = chunkEmbeddings.map((item, index) => ({ 
            id: index + 1, 
            vector: item.embedding, 
            payload: { 
                text: item.text, 
            }, 
            })); 

            await qdrant.upsert("pdf-docs", { points, }); 

        // Select a chunk for the question-answering demo
        const question = req.body.question || 'Summarize this PDF';
        const questionEmbedding = await createEmbedding(
            question,
            'RETRIEVAL_QUERY'
        );

       
        const searchResult = await qdrant.query('pdf-docs', {
            query: questionEmbedding,
            limit: 1,
            with_payload: true,
            with_vector: true
        });

        if (searchResult.points.length === 0) {
            return res.status(404).send('No matching chunks found');
        }

        const bestChunk = searchResult.points[0].payload.text;
        const bestScore = searchResult.points[0].score;

        // console.log('Best matching chunk:', bestChunk);
        // console.log('Similarity score:', bestScore);



       // Basic keyword matching; not semantic similarity
        // const keywords = question
        //     .toLowerCase()
        //     .replace(/[?!.,]/g, '')
        //     .split(/\s+/)
        //     .filter(word => word.length > 2);

           
            // best chuck for q , and 
      
        //     let bestScore = -Infinity;

        //     for(const item of chunkEmbeddings)
        //     {
        //         const score = cosineSimilarity(questionEmbedding , item.embedding);
        //         if(score>bestScore)
        //         {
        //             bestChunk = item.text;
        //             bestScore = score;
        //         }
        //     }
        //     console.log(bestChunk);
        // console.log(bestScore);

             
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: `Answer the question using this context.

        Context: ${bestChunk}

        Question: ${question}`
        });

              // Return the embedding and other results to Postman
 
        res.json({
            id: searchResult.points[0].id,
            vector: searchResult.points[0].vector ?? null,
            payload: searchResult.points[0].payload,
            similarityScore: bestScore,
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
