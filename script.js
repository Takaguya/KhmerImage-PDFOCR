const class_labels = {
    "Khmer OS": 0,
    "Khmer OS Battambong": 1,
    "Khmer OS Siemreap": 2,
    // Add more classes as needed
};

// Load ONNX model
const onnxModelPath = 'model.onnx';
const session = new onnx.InferenceSession();
await session.loadModel(onnxModelPath);

// File selection handler
document.getElementById('file').addEventListener('change', function() {
    const fileName = this.files[0]?.name || 'No file selected';
    document.getElementById('file-name').innerText = fileName;
});

// Process button click handler
document.getElementById('process-button').addEventListener('click', async function () {
    const fileInput = document.getElementById('file');
    const file = fileInput.files[0];
    const outputArea = document.getElementById('font-detected');
    const confidenceArea = document.getElementById('confidence');
    const ocrTextArea = document.getElementById('ocr-text');
    const loadingSpinner = document.getElementById('loading-spinner');
    const downloadButton = document.getElementById('download-docx');
    const resultContainer = document.getElementById('result-container');
    const fileExt = file.name.split('.').pop().toLowerCase();

    if (!file) {
        alert('Please select a file');
        return;
    }

    loadingSpinner.style.display = 'block';
    resultContainer.style.display = 'none';

    try {
        let ocrText = '';
        let font = 'Unknown Font'; // Default value
        let confidence = 'N/A'; // Default value
        let fontClass = '';

        if (fileExt === 'pdf') {
            const pdfText = await processPDF(file);
            ocrText = pdfText.text;
        } else if (['jpg', 'jpeg', 'png', 'bmp', 'tiff'].includes(fileExt)) {
            const img = await loadImage(file);
            const fontDetection = await cropAndPredict(img);
            ocrText = await runOCR(img);
            font = fontDetection.font || 'Unknown Font';
            confidence = fontDetection.confidence?.toFixed(2) || 'N/A';
            fontClass = fontDetection.fontClass || '';
        } else {
            alert("Unsupported file type.");
            return;
        }

        resultContainer.style.display = 'block';
        outputArea.innerHTML = `Font Detected: <span class="${fontClass}">${font}</span>`;
        confidenceArea.innerHTML = `Confidence: ${confidence}`;
        ocrTextArea.innerHTML = `<pre>${ocrText}</pre>`;
        downloadButton.style.display = 'inline-block';

        downloadButton.addEventListener('click', () => {
            generateDocx(ocrText, font, confidence);
        });
    } catch (error) {
        outputArea.innerHTML = `<p>Error: ${error.message}</p>`;
    } finally {
        loadingSpinner.style.display = 'none';
    }
});

// Preprocess image (updated based on your script)
function preprocessImage(image, targetSize = [256, 256]) {
    return tf.tidy(() => {
        return tf.browser.fromPixels(image)
            .resizeBilinear(targetSize)
            .div(tf.scalar(255))
            .expandDims(0);
    });
}

// Detect words and crop (updated for OCR)
async function detectWordsAndCrop(imagePath) {
    const image = await cv.imreadAsync(imagePath);
    const gray = image.bgrToGray();
    const config = { lang: 'eng+km', psm: 6 };
    const { data: { text, conf, left, top, width, height } } = await tesseract.recognize(image, config);

    const wordBoxes = [];
    for (let i = 0; i < text.length; i++) {
        if (parseInt(conf[i]) > 0) {
            const word = text[i].trim();
            if (word !== "") {
                wordBoxes.push({
                    word,
                    x: left[i],
                    y: top[i],
                    w: width[i],
                    h: height[i],
                    conf: parseInt(conf[i]),
                });
            }
        }
    }
    return { wordBoxes, image };
}

// Crop and predict font
async function cropAndPredict(imagePath, numWords = 3) {
    const { wordBoxes, image } = await detectWordsAndCrop(imagePath);

    if (!wordBoxes.length) {
        console.log("No text detected.");
        return;
    }

    const limitedWordBoxes = wordBoxes.slice(0, numWords);
    for (const { word, x, y, w, h } of limitedWordBoxes) {
        const croppedImage = image.getRegion(new cv.Rect(x, y, w, h));
        const croppedImageRgb = preprocessImage(croppedImage);
        const inputTensor = new onnx.Tensor(croppedImageRgb.dataSync(), 'float32', [1, 1, 256, 256]);  // Shape (1, 1, 256, 256)

        const outputs = await session.run([inputTensor]);
        const predictions = outputs[0].data;

        const predictedClass = predictions.indexOf(Math.max(...predictions));
        const confidence = Math.max(...predictions);
        const fontNames = Object.keys(class_labels);

        // Show result on the page
        document.getElementById('font-detected').innerHTML = `Font Detected: ${fontNames[predictedClass]}`;
        document.getElementById('confidence').innerHTML = `Confidence: ${confidence.toFixed(4)}`;
    }
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

