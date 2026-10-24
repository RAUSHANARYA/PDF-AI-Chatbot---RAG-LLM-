const express = require('express')
const multer = require('multer')
const app = express();

const upload = multer({dest:"uploads/"});
app.get('/',(req,res)=>{
    res.send('hey i am raushan')
})

// upload.single is act as  middle heree , we use post 
app.post('/upload',upload.single("pdf"),(req,res)=>{
    console.log(req.file);
    res.send("file uploaded successfully");
})

app.listen(3000,()=>{
    console.log('server is running on port 3000')
})