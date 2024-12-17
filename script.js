let model;

// Load the TensorFlow.js model
async function loadModel() {
    try {
        const modelUrl = './models/model.json'; // Adjust this path as needed
        model = await tf.loadLayersModel(modelUrl);
        console.log("Model loaded successfully!");
    } catch (error) {
        console.error("Failed to load the model. Please check the model path or server configuration.", error);
    }
}

// Preprocess the image before passing it to the model
function preprocessImage(image) {
    return tf.tidy(() => {
        const tensor = tf.browser.fromPixels(image)
            .resizeBilinear([256, 256])  // Resize to the input size expected by the model
            .div(tf.scalar(255))         // Normalize to [0, 1]
            .expandDims(0);              // Add batch dimension (1 image in a batch)
        return tensor;
    });
}

// Detect the font from the image
async function detectFont(image) {
    if (!model) {
        console.error("Model is not loaded yet! Please wait.");
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

// Handle file input and image processing
async function handleUpload() {
    const fileInput = document.getElementById('file');
    const file = fileInput.files[0];

    if (!file) {
        alert("Please upload a file first!");
        return;
    }

    const reader = new FileReader();

    if (file.type === 'application/pdf') {
        // Handle PDF files
        reader.onload = async function(e) {
            const pdfData = e.target.result;
            const images = await extractImagesFromPDF(pdfData);
            if (images.length > 0) {
                const img = images[0];
                const result = await detectFont(img);

                displayResult(result, img.toDataURL());
            } else {
                console.error("No images extracted from the PDF.");
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        // Handle image files
        reader.onload = function(e) {
            const img = new Image();
            img.onload = async function() {
                const result = await detectFont(img);
                displayResult(result, e.target.result);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

// Display the result in the UI
function displayResult(result, imageSrc) {
    const resultDiv = document.getElementById("font-detected");

    if (result) {
        resultDiv.innerHTML = `
            <h3>Detected Font:</h3>
            <p><strong>Font:</strong> ${result.font}</p>
            <p><strong>Confidence:</strong> ${result.confidence.toFixed(2)}</p>
            <img src="${imageSrc}" alt="Uploaded Image" style="max-width: 200px; margin-top: 10px;">
        `;
    } else {
        resultDiv.innerHTML = `
            <h3>Error:</h3>
            <p>Could not detect font. Ensure the model is loaded and the image is clear.</p>
        `;
    }
}

// Extract images from PDF using pdf.js
async function extractImagesFromPDF(pdfData) {
    return new Promise((resolve, reject) => {
        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        loadingTask.promise.then(function(pdf) {
            pdf.getPage(1).then(function(page) {
                const scale = 1.5;
                const viewport = page.getViewport({ scale: scale });
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };

                page.render(renderContext).promise.then(function() {
                    resolve([canvas]); // Return the first page as an image (Canvas)
                }).catch(reject);
            });
        }).catch(reject);
    });
}

// Add event listeners
window.addEventListener('DOMContentLoaded', () => {
    loadModel(); // Load the model when the page loads

    const processButton = document.getElementById('process-button');
    processButton.addEventListener('click', handleUpload);
});
