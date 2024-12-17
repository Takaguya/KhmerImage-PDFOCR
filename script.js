let model;

// Load TensorFlow.js model
async function loadModel() {
    try {
        const modelUrl = './models/model.json'; // Adjust the path if necessary
        model = await tf.loadLayersModel(modelUrl);
        console.log("Model loaded successfully!");
    } catch (error) {
        console.error("Error loading model:", error);
    }
}

// Handle file input change
const fileInput = document.getElementById('file');
fileInput.addEventListener('change', () => {
    const fileNameDisplay = document.getElementById('file-name');
    fileNameDisplay.textContent = fileInput.files.length > 0 ? fileInput.files[0].name : 'No file selected';
});

// Preprocess the image for the model
function preprocessImage(image) {
    return tf.tidy(() => {
        const tensor = tf.browser.fromPixels(image)
            .resizeBilinear([256, 256])
            .div(tf.scalar(255))
            .expandDims(0);
        return tensor;
    });
}

// Detect font
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

// Extract images from PDF
async function extractImagesFromPDF(pdfData) {
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;
    return [canvas];
}

// Process uploaded file
async function handleUpload() {
    const file = fileInput.files[0];
    if (!file) {
        alert("Please select a file!");
        return;
    }

    const spinner = document.getElementById('loading-spinner');
    spinner.style.display = 'block'; // Show spinner

    try {
        if (file.type === 'application/pdf') {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const pdfData = e.target.result;
                const images = await extractImagesFromPDF(pdfData);
                const result = await detectFont(images[0]);
                displayResult(result, images[0].toDataURL());
            };
            reader.readAsArrayBuffer(file);
        } else {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = async () => {
                    const result = await detectFont(img);
                    displayResult(result, e.target.result);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    } catch (error) {
        console.error("Error processing file:", error);
    } finally {
        spinner.style.display = 'none'; // Hide spinner
    }
}

// Display results
function displayResult(result, imageSrc) {
    const resultDiv = document.getElementById("font-detected");
    if (result) {
        resultDiv.innerHTML = `
            <h3>Detected Font:</h3>
            <p><strong>Font:</strong> ${result.font}</p>
            <p><strong>Confidence:</strong> ${result.confidence.toFixed(2)}</p>
            <img src="${imageSrc}" alt="Uploaded Image" style="max-width: 100%; margin-top: 10px;">
        `;
    } else {
        resultDiv.innerHTML = `
            <h3>Error:</h3>
            <p>Font detection failed. Please try again.</p>
        `;
    }
}

// Initialize
document.getElementById('process-button').addEventListener('click', handleUpload);
window.addEventListener('DOMContentLoaded', loadModel);
