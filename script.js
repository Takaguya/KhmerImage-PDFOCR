// Load the model using TensorFlow.js
let model;
async function loadModel() {
    try {
        const modelUrl = './models/model.json';  // Adjust the path if needed
        model = await tf.loadLayersModel(modelUrl);
        console.log("Model loaded successfully!");
    } catch (error) {
        console.error("Error loading model:", error);
    }
}

// Preprocess the image for font classification
function preprocessImage(image, targetSize = [256, 256]) {
    return tf.tidy(() => {
        const tensor = tf.browser.fromPixels(image)
            .resizeBilinear(targetSize)
            .div(tf.scalar(255))
            .expandDims(0);  // Add batch dimension
        return tensor;
    });
}

// Detect font using the pre-trained model
async function detectFont(image) {
    if (!model) {
        console.error("Model is not loaded. Please wait.");
        return null;
    }

    const preprocessedImage = preprocessImage(image);
    const predictions = await model.predict(preprocessedImage).data();
    const fontClassIndex = predictions.indexOf(Math.max(...predictions));
    const confidence = predictions[fontClassIndex];
    const fontClasses = ["Khmer OS", "Khmer OS Battambong", "Khmer OS Siemreap"];
    const predictedFont = fontClasses[fontClassIndex];

    return { font: predictedFont, confidence };
}

// Handle file upload and process it
async function handleUpload() {
    const fileInput = document.getElementById('file');
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select a file!");
        return;
    }

    const fileExt = file.name.split('.').pop().toLowerCase();
    const outputArea = document.getElementById('font-detected');
    const spinner = document.getElementById('loading-spinner');
    const downloadButton = document.getElementById('download-button');
    spinner.style.display = 'block';  // Show loading spinner
    outputArea.innerHTML = "";  // Clear previous results
    downloadButton.style.display = 'none'; // Hide download button

    try {
        let ocrText = '';
        let fontInfo = '';
        
        if (fileExt === 'pdf') {
            const pdfText = await processPDF(file);
            ocrText = pdfText.text;
            fontInfo = `Detected font: ${pdfText.font} (Confidence: ${pdfText.confidence})`;
        } else if (['jpg', 'jpeg', 'png', 'bmp', 'tiff'].includes(fileExt)) {
            const image = await loadImage(file);
            const { font, confidence } = await detectFont(image);
            ocrText = await runOCR(image); // Run OCR on image
            fontInfo = `Detected font: ${font} (Confidence: ${confidence.toFixed(2)})`;
        } else {
            alert("Unsupported file type.");
        }

        outputArea.innerHTML = `<p>${fontInfo}</p><pre>${ocrText}</pre>`;
        downloadButton.style.display = 'block'; // Show download button
        downloadButton.onclick = () => downloadOCRAsDocx(ocrText, fontInfo);
        
    } catch (error) {
        console.error("Error processing file:", error);
        outputArea.innerHTML = `<p>Error processing file: ${error.message}</p>`;
    } finally {
        spinner.style.display = 'none';  // Hide loading spinner
    }
}

// Load an image from the file input
function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

// Run OCR on an image using Tesseract.js
function runOCR(image) {
    return new Promise((resolve, reject) => {
        Tesseract.recognize(
            image,
            'khm+eng',
            {
                logger: (m) => console.log(m),
            }
        ).then(({ data: { text } }) => {
            resolve(text);
        }).catch(reject);
    });
}

// Process PDF and extract images using PDF.js and OCR
async function processPDF(file) {
    const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
    const textData = [];
    let font = null;
    let confidence = null;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const viewport = page.getViewport({ scale: 1 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport }).promise;
        
        const image = canvas.toDataURL();  // Get image as data URL
        const img = new Image();
        img.src = image;
        
        img.onload = async () => {
            const { font: pageFont, confidence: pageConfidence } = await detectFont(img);
            if (!font || pageConfidence > confidence) {
                font = pageFont;
                confidence = pageConfidence;
            }
        };
        
        const ocrText = await runOCR(img);
        textData.push(ocrText);
    }

    return {
        text: textData.join('\n\n'),
        font,
        confidence,
    };
}

// Function to create a DOCX file and download it
function downloadOCRAsDocx(ocrText, fontInfo) {
    const doc = new PizZip();
    const template = docxtemplater(new PizZip("")); // Empty template

    template.setData({
        ocrText,
        fontInfo
    });

    template.render();

    const output = template.getZip().generate({ type: 'blob' });

    const blob = new Blob([output], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'OCR_Result.docx';
    link.click();
}

// Attach event listeners
document.getElementById('upload-button').addEventListener('click', handleUpload);
window.addEventListener('DOMContentLoaded', loadModel);
