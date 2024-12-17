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
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select a file!");
        return;
    }

    const fileExt = file.name.split('.').pop().toLowerCase();
    const outputArea = document.getElementById('output-area');
    const spinner = document.getElementById('loading-spinner');
    spinner.style.display = 'block';  // Show loading spinner

    try {
        if (fileExt === 'pdf') {
            const pdfText = await processPDF(file);
            outputArea.innerHTML = `<p>Detected font: ${pdfText.font} (Confidence: ${pdfText.confidence})</p><pre>${pdfText.text}</pre>`;
        } else if (['jpg', 'jpeg', 'png', 'bmp', 'tiff'].includes(fileExt)) {
            const image = await loadImage(file);
            const { font, confidence } = await detectFont(image);
            const ocrText = await runOCR(image); // Run OCR on image
            outputArea.innerHTML = `<p>Detected font: ${font} (Confidence: ${confidence.toFixed(2)})</p><pre>${ocrText}</pre>`;
        } else {
            alert("Unsupported file type.");
        }
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

// Attach event listeners
document.getElementById('upload-button').addEventListener('click', handleUpload);
window.addEventListener('DOMContentLoaded', loadModel);
