let model;

// Load the TensorFlow.js model
async function loadModel() {
    model = await tf.loadLayersModel('models/model.json'); // Path to your model
    console.log("Model loaded!");
}

// Preprocess the image before passing it to the model
function preprocessImage(image) {
    return tf.tidy(() => {
        const tensor = tf.browser.fromPixels(image)
            .resizeBilinear([256, 256])  // Resize to the input size expected by the model
            .div(tf.scalar(255))         // Normalize to [0, 1]
            .expandDims(0);              // Add batch dimension
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

// Handle file input and image processing when the user clicks the 'Upload and Process' button
async function handleUpload(event) {
    const fileInput = document.getElementById('file');
    const file = fileInput.files[0];

    if (file) {
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
    }
}

// Add event listeners after the DOM has fully loaded
window.addEventListener('DOMContentLoaded', () => {
    loadModel(); // Load the model when the page loads

    // Add event listener to the button
    const processButton = document.getElementById('process-button');
    processButton.addEventListener('click', handleUpload);
});
