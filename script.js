let model;

// Load TensorFlow.js model
async function loadModel() {
    try {
        const modelUrl = './models/model.json'; // Adjust the path if necessary
        model = await tf.loadLayersModel(modelUrl);
        console.log("Model loaded successfully!");
    } catch (error) {
        console.error("Error loading model:", error);
        alert("Failed to load the model. Please try refreshing the page.");
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
        try {
            const tensor = tf.browser.fromPixels(image)
                .resizeBilinear([256, 256])
                .div(tf.scalar(255))
                .expandDims(0);
            return tensor;
        } catch (error) {
            console.error("Error preprocessing image:", error);
            throw new Error("Preprocessing failed");
        }
    });
}

// Detect font
async function detectFont(image) {
    if (!model) {
        throw new Error("Model is not loaded yet!");
    }

    try {
        const preprocessedImage = preprocessImage(image);
        const predictions = await model.predict(preprocessedImage).data();
        const fontClassIndex = predictions.indexOf(Math.max(...predictions));
        const confidence = predictions[fontClassIndex];
        const fontClasses = ["Khmer OS", "Khmer OS Battambong", "Khmer OS Siemreap"];
        const predictedFont = fontClasses[fontClassIndex];

        return { font: predictedFont, confidence };
    } catch (error) {
        console.error("Error during font detection:", error);
        throw error;
    }
}

// Extract images from PDF
async function extractImagesFromPDF(pdfData) {
    try {
        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        const pdf = await loadingTask.promise;
        const images = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            const page = await pdf.getPage(pageNumber);
            const scale = 1.5;
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({ canvasContext: context, viewport }).promise;
            images.push(canvas);
        }

        return images;
    } catch (error) {
        console.error("Error extracting images from PDF:", error);
        throw error;
    }
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
        let image;
        let imageSrc;

        if (file.type === 'application/pdf') {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const pdfData = e.target.result;
                const images = await extractImagesFromPDF(pdfData);
                image = images[0];
                imageSrc = image.toDataURL();
                const result = await detectFont(image);
                displayResult(result, imageSrc);
            };
            reader.readAsArrayBuffer(file);
        } else {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = async () => {
                    image = img;
                    imageSrc = e.target.result;
                    const result = await detectFont(img);
                    displayResult(result, imageSrc);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    } catch (error) {
        console.error("Error processing file:", error);
        alert("Failed to process the file. Please try again.");
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
