const express = require('express')
const multer = require('multer')
const app = express(); 
const fs = require('fs');
const pdfParse = require('pdf-parse');

const upload = multer({dest:"uploads/"});
app.get('/',(req,res)=>{
    res.send('hey i am raushan')
})

// upload.single is act as  middleware(route hone se phle k process) heree , we use post 
app.post('/upload', upload.single("pdf"), async (req, res) => {
    try {
        console.log(req.file);

        const dataBuffer = fs.readFileSync(req.file.path);
        const pdfData = await pdfParse(dataBuffer);
        const text = pdfData.text;
        console.log("PDF extraction successful");

        
        const chunks = []; 
        
        for (let i = 0; i < text.length; i += 500) { 
        chunks.push(text.slice(i, i + 500)); 
        } 
        
        console.log(chunks); 
        
        res.json({ 
        totalChunks: chunks.length, 
        chunks, 
        }); 
        res.send(text);
    } 

      
    catch (error) 
    {
        console.error(error);
        res.status(500).send("PDF text extraction failed");
    }
});

app.listen(3000,()=>{
    console.log('server is running on port 3000')
}) 