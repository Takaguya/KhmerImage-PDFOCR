const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const tesseract = require('tesseract.js');

const app = express();
const upload = multer({ dest: 'uploads/' });  // Temporary storage for uploaded files

// Serve static files (e.g., CSS, JavaScript, images)
app.use(express.static('public'));

// Handle file upload and processing
app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = path.join(__dirname, req.file.path);
    
    try {
        // OCR processing with tesseract.js
        const result = await tesseract.recognize(filePath, 'eng+khm', {
            logger: (m) => console.log(m),
        });

        const ocrText = result.data.text;
        const fontName = "Khmer OS Battambong";  // Hardcoded for now, ideally would use your font detection
        const fontConfidence = "High";  // Hardcoded for now

        // Simulate a file download link (you would generate this DOCX file)
        const downloadLink = "/download/" + path.basename(filePath, path.extname(filePath)) + ".docx";

        // Respond with OCR result and font info
        res.json({ ocrText, fontName, fontConfidence, downloadLink });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error processing the file" });
    } finally {
        // Optionally remove the file after processing to free up space
        fs.unlinkSync(filePath);
    }
});

// Handle file download
app.get('/download/:filename', (req, res) => {
    const file = path.join(__dirname, 'downloads', req.params.filename);  // Path to generated DOCX
    res.download(file);  // Send the file for download
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
