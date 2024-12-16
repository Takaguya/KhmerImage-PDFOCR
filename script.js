let model;

// Load the TensorFlow.js model
async function loadModel() {
    try {
        model = await tf.loadLayersModel('models/model.json'); // Path to your model
        console.log("Model loaded!");
    } catch (error) {
        console.error("Model loading failed:", error);
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
        console.error("Model is not loaded yet!");
        return;
    }
    
    const preprocessedImage = preprocessImage(image);
    const predictions = await model.predict(preprocessedImage).data(); // Get predictions
    const fontClassIndex = predictions.indexOf(Math.max(...predictions)); // Get the index of the highest prediction
    const confidence = predictions[fontClassIndex]; // Get the confidence of the prediction
    const fontClasses = ["Khmer OS", "Khmer OS Battambong", "Khmer OS Siemreap"]; // Replace with actual font classes
    const predictedFont = fontClasses[fontClassIndex];

    return { font: predictedFont, confidence };
}

// Handle file input and image processing when the user clicks the 'Upload and Process' button
async function handleUpload(event) {
    const fileInput = document.getElementById('file');
    const file = fileInput.files[0];

    if (file) {
        const reader = new FileReader();

        if (file.type === 'application/pdf') {
            // Handle PDF files
            reader.onload = async function(e) {
                const pdfData = e.target.result;
                const images = await extractImagesFromPDF(pdfData);
                if (images.length > 0) {
                    const img = images[0]; // Take the first image
                    const result = await detectFont(img);

                    // Displaying the result
                    const resultDiv = document.getElementById("font-detected");
                    resultDiv.innerHTML = `
                        <h3>Detected Font:</h3>
                        <p><strong>Font:</strong> ${result.font}</p>
                        <p><strong>Confidence:</strong> ${result.confidence.toFixed(2)}</p>
                        <img src="${img.src}" alt="Uploaded Image" style="max-width: 200px; margin-top: 10px;">
                    `;
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            // Handle image files
            reader.onload = function(e) {
                const img = new Image();
                img.onload = async function() {
                    // Run the font detection model
                    const result = await detectFont(img);

                    // Displaying the result
                    const resultDiv = document.getElementById("font-detected");
                    resultDiv.innerHTML = `
                        <h3>Detected Font:</h3>
                        <p><strong>Font:</strong> ${result.font}</p>
                        <p><strong>Confidence:</strong> ${result.confidence.toFixed(2)}</p>
                        <img src="${e.target.result}" alt="Uploaded Image" style="max-width: 200px; margin-top: 10px;">
                    `;
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    }
}

// Extract images from PDF using pdf.js
async function extractImagesFromPDF(pdfData) {
    return new Promise((resolve, reject) => {
        const loadingTask = pdfjsLib.getDocument(pdfData);
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

// Add event listeners after the DOM has fully loaded
window.addEventListener('DOMContentLoaded', () => {
    loadModel(); // Load the model when the page loads

    // Add event listener to the button
    const processButton = document.getElementById('process-button');
    processButton.addEventListener('click', handleUpload);
});
