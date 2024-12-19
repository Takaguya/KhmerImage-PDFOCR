const class_labels = {
    "Khmer OS": 0,
    "Khmer OS Battambong": 1,
    "Khmer OS Siemreap": 2,
    // Add more classes as needed
};

async function loadModel() {
    try {
        const onnxModelPath = 'models/model.onnx'; // Adjust if necessary
        const session = await ort.InferenceSession.create(onnxModelPath);
        console.log('Model loaded successfully');
        return session;
    } catch (error) {
        console.error('Error loading the ONNX model:', error.message || error);
        console.error('Stack trace:', error.stack);
        throw error;
    }
}

// Call the function and use the model session
let session = null; // Initialize session as null
loadModel().then(loadedSession => {
    session = loadedSession; // Store the loaded session
}).catch(err => {
    console.error("Error loading ONNX model:", err);
});



// Handle Detect Font Button Click
document.getElementById('detect-font-button').addEventListener('click', async function () {
    const fileInput = document.getElementById('file');
    const file = fileInput.files[0];
    const outputArea = document.getElementById('font-detected');
    const confidenceArea = document.getElementById('confidence');
    const resultContainer = document.getElementById('result-container');
    const fileExt = file.name.split('.').pop().toLowerCase();

    if (!file) {
        alert('Please select a file');
        return;
    }

    // Show loading spinner or hide results initially
    resultContainer.style.display = 'none'; // Hide result initially

    try {
        let font = 'Unknown Font'; // Default font
        let confidence = 'N/A'; // Default confidence

        // Handle image files (JPG, PNG, etc.)
        if (['jpg', 'jpeg', 'png', 'bmp', 'tiff'].includes(fileExt)) {
            const img = await loadImage(file); // Load image
            const fontDetection = await cropAndPredict(img); // Your font detection logic
            font = fontDetection.font || 'Unknown Font';
            confidence = fontDetection.confidence?.toFixed(2) || 'N/A';
        }

        // Show the result container and populate the fields
        resultContainer.style.display = 'block';
        outputArea.innerHTML = `Font Detected: ${font}`;
        confidenceArea.innerHTML = `Confidence: ${confidence}`;

    } catch (error) {
        outputArea.innerHTML = `<p>Error: ${error.message}</p>`;
        console.error(error);
    }
});

// Handle Perform OCR Button Click
document.getElementById('perform-ocr-button').addEventListener('click', async function () {
    const fileInput = document.getElementById('file');
    const file = fileInput.files[0];
    const ocrTextArea = document.getElementById('ocr-text');
    const resultContainer = document.getElementById('result-container');
    const fileExt = file.name.split('.').pop().toLowerCase();

    if (!file) {
        alert('Please select a file');
        return;
    }

    // Show loading spinner or hide results initially
    resultContainer.style.display = 'none'; // Hide result initially

    try {
        let ocrText = '';

        // Handle PDF files
        if (fileExt === 'pdf') {
            const pdfText = await processPDF(file);
            ocrText = pdfText.text;
        } 
        // Handle image files (JPG, PNG, etc.)
        else if (['jpg', 'jpeg', 'png', 'bmp', 'tiff'].includes(fileExt)) {
            const img = await loadImage(file);
            ocrText = await runOCR(img);
        }

        // Show the result container and populate the OCR result
        resultContainer.style.display = 'block';
        ocrTextArea.innerHTML = `<pre>${ocrText}</pre>`;

    } catch (error) {
        ocrTextArea.innerHTML = `<p>Error: ${error.message}</p>`;
        console.error(error);
    }
});

// Preprocess image
function preprocessImage(image, targetSize = [256, 256]) {
    return tf.tidy(() => {
        return tf.browser.fromPixels(image)
            .resizeBilinear(targetSize)
            .div(tf.scalar(255))
            .expandDims(0);
    });
}

// OCR function
function runOCR(image) {
    return Tesseract.recognize(image, 'khm+eng', { logger: (m) => console.log(m) })
        .then(({ data: { text } }) => text);
}

// PDF processing function
async function processPDF(file) {
    const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
    const textData = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const canvas = document.createElement('canvas');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const image = canvas.toDataURL();
        const img = new Image();
        img.src = image;
        textData.push(await runOCR(img));
    }
    return { text: textData.join('\n') };
}

// Load image from file input
function loadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                resolve(img); // Resolve the promise with the image object
            };
            img.onerror = function () {
                reject(new Error("Failed to load image."));
            };
            img.src = e.target.result;
        };

        reader.onerror = function () {
            reject(new Error("Failed to read file."));
        };

        reader.readAsDataURL(file); // Read the file as a data URL
    });
}

// Crop and predict font class
async function cropAndPredict(image) {
    if (!session) {
        throw new Error("Model not loaded yet.");
    }

    // Helper function for detecting words and getting bounding boxes (same as in the second code)
    function detectWordsAndCrop(image) {
        const gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY);

        // Use pytesseract to get bounding boxes around words (for demonstration purposes, this assumes pytesseract is available)
        const customConfig = r'-l khm+eng --psm 6';  // PSM 6 assumes a single uniform block of text
        const d = pytesseract.image_to_data(gray, { output_type: pytesseract.Output.DICT, config: customConfig, lang: 'eng+km' });

        const wordBoxes = [];
        for (let i = 0; i < d.text.length; i++) {
            if (parseInt(d.conf[i]) > 0 && d.text[i].trim() !== "") {
                const { left, top, width, height } = d;
                wordBoxes.push({
                    word: d.text[i],
                    x: left[i],
                    y: top[i],
                    w: width[i],
                    h: height[i],
                    confidence: parseInt(d.conf[i])
                });
            }
        }
        return { wordBoxes, image };
    }

    // Preprocess the image (same as before)
    console.log("Preprocessing image...");
    let processedImage = preprocessImage(image);

    // Check input tensor shape
    console.log("Input tensor shape:", processedImage.shape);

    // Remove extra dimension if present
    processedImage = processedImage.squeeze([1]);  // Remove the second dimension

    // Verify new shape after squeeze
    console.log("Shape after squeeze:", processedImage.shape);

    // Detect words and get bounding boxes
    console.log("Detecting words...");
    const { wordBoxes, image } = detectWordsAndCrop(image);

    if (!wordBoxes.length) {
        console.log("No text detected.");
        return null;
    }

    // Limit to the first 3 detected words
    const limitedWordBoxes = wordBoxes.slice(0, 3);

    for (const { word, x, y, w, h, confidence } of limitedWordBoxes) {
        // Crop the region containing the word
        const croppedImage = image.slice(y, y + h, x, x + w);

        // Preprocess the cropped image for prediction
        let croppedImageRgb = preprocessImage(croppedImage);

        // Flatten to match ONNX input requirements (batch size 1)
        croppedImageRgb = np.expand_dims(croppedImageRgb, 0).astype(np.float32);

        // Run inference using the ONNX model
        try {
            console.log("Running inference...");
            const output = await session.run({ 'conv2d_input': croppedImageRgb });

            // Log the output tensor and its data (raw prediction values)
            const predictions = output.values().next().value.data;
            console.log("Raw predictions:", predictions);

            // Get the predicted font class and confidence score
            const predictedClass = predictions.indexOf(Math.max(...predictions));  // Index of the highest confidence
            const fontConfidence = predictions[predictedClass];

            // Log the predicted class and confidence score
            console.log(`Predicted Class Index: ${predictedClass}`);
            console.log(`Confidence Score: ${fontConfidence}`);

            // Map class index to font name (Ensure class_labels is correctly populated)
            const font = class_labels[predictedClass] || 'Unknown Font';  // Default to 'Unknown Font' if not found
            console.log(`Font Detected: ${font}`);

            return {
                font: font,
                confidence: fontConfidence.toFixed(2) || 'N/A',  // Format the confidence to 2 decimal places
                fontClass: predictedClass  // Optionally, include the numeric class label
            };
        } catch (error) {
            console.error("Prediction error:", error);
            throw new Error("Failed to perform prediction");
        }
    }
}




// DOCX file generator function
function generateDocx(text, font, confidence) {
    const zip = new JSZip();
    const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const docContent = `
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:body>
                <w:p><w:r><w:t>Detected Font: ${font}</w:t></w:r></w:p>
                <w:p><w:r><w:t>Confidence: ${confidence}</w:t></w:r></w:p>
                <w:p><w:r><w:t>${escapedText}</w:t></w:r></w:p>
            </w:body>
        </w:document>`;

    zip.file('word/document.xml', docContent);
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
            <Default Extension="xml" ContentType="application/xml"/>
            <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
            <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
        </Types>`);

    zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="document.xml"/>
        </Relationships>`);

    zip.generateAsync({ type: 'blob' }).then(content => {
        saveAs(content, 'ocr_result.docx');
    });
}
