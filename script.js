let model;

// Load the TensorFlow.js model
async function loadModel() {
    model = await tf.loadLayersModel('models/model.json'); // Path to your model
    console.log("Model loaded!");
}

// Preprocess the image before passing it to the model
function preprocessImage(image) {
    return tf.tidy(() => {
        // Convert image to tensor and resize it to match model input size
        const tensor = tf.browser.fromPixels(image)
            .resizeBilinear([256, 256])  // Resize to the input size expected by the model
            .div(tf.scalar(255))         // Normalize to [0, 1]
            .expandDims(0);              // Add batch dimension (1 image in a batch)
        
        return tensor;
    });
}
// Detect the font from the image
async function detectFont(image) {
    const preprocessedImage = preprocessImage(image);
    const predictions = await model.predict(preprocessedImage).data(); // Get predictions
    const fontClassIndex = predictions.indexOf(Math.max(...predictions)); // Get the index of the highest prediction
    const confidence = predictions[fontClassIndex]; // Get the confidence of the prediction
    const fontClasses = ["Khmer OS", "Khmer OS Battambong", "Khmer OS Siemreap"]; // Replace with actual font classes
    const predictedFont = fontClasses[fontClassIndex];

    return { font: predictedFont, confidence };
}

// Convert a PDF file to an image using pdf.js
function convertPdfToImage(pdfFile) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const typedarray = new Uint8Array(e.target.result);
            pdfjsLib.getDocument(typedarray).promise.then(pdf => {
                pdf.getPage(1).then(page => {
                    const viewport = page.getViewport({ scale: 1 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    page.render({
                        canvasContext: context,
                        viewport: viewport
                    }).promise.then(() => {
                        resolve(canvas);
                    }).catch(reject);
                });
            }).catch(reject);
        };
        reader.readAsArrayBuffer(pdfFile);
    });
}

// Handle file input and image processing when the user clicks the 'Upload and Process' button
async function handleUpload(event) {
    const fileInput = document.getElementById('file');
    const file = fileInput.files[0];

    if (file) {
        const fileType = file.type;

        if (fileType.startsWith('image/')) {
            // If it's an image, process it directly
            const reader = new FileReader();
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
        } else if (fileType === 'application/pdf') {
            // If it's a PDF, convert it to an image
            const canvas = await convertPdfToImage(file);
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
                    <img src="${canvas.toDataURL()}" alt="Converted PDF Image" style="max-width: 200px; margin-top: 10px;">
                `;
            };
            img.src = canvas.toDataURL();
        }
    }
}

// Add event listeners after the DOM has fully loaded
window.addEventListener('DOMContentLoaded', () => {
    loadModel(); // Load the model when the page loads

    // Add event listener to the button
    const processButton = document.getElementById('process-button');
    processButton.addEventListener('click', handleUpload);
});
