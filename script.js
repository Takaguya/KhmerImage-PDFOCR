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

    // Preprocess the image
    const processedImage = preprocessImage(image);

    // Perform inference using the ONNX model
    const output = await session.run({ input: processedImage });
    const predictions = output.values().next().value.data;

    // Get the predicted font class and confidence score
    const predictedClass = predictions.indexOf(Math.max(...predictions));
    const confidence = predictions[predictedClass];

    // Map class index to font name
    const font = Object.keys(class_labels)[predictedClass];

    return {
        font: font,
        confidence: confidence,
        fontClass: class_labels[font] // Optionally, add the font's numeric class label
    };
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
