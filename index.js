
const express = require('express')
const multer = require('multer')
const fs = require('fs');
const pdfParse = require('pdf-parse');
const {GoogleGenAI} = require('@google/genai');
require('dotenv').config();

const app = express();
const upload = multer({dest: "uploads/"});

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

app.get('/', (req, res) => {
    res.send('hey i am raushan')
});

app.post('/upload', upload.single("pdf"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send("Please upload a PDF file");
        }

        const dataBuffer = fs.readFileSync(req.file.path);
        const pdfData = await pdfParse(dataBuffer);
        const text = pdfData.text;

        const chunks = text.split('\n\n');

        const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: `Explain this PDF in simple text:\n${text}`
        });
        const rasuhan = req.data;
        res.json({
            totalChunks: chunks.length,
            chunks,
            summary: response.text
        });

    } catch (error) {
        console.error(error);
        res.status(500).send(error.message);
    }
});

app.listen(3000, () => {
    console.log('server is running on port 3000')
});
