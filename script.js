// script.js

// Handle file input and OCR processing
function handleFileInput(event) {
    const file = event.target.files[0];  // Get the selected file
    if (file) {
        const reader = new FileReader();  // Create a FileReader to read the file
        reader.onload = function(e) {
            const img = new Image();  // Create an image element
            img.onload = function() {
                // Perform OCR using tesseract.js
                Tesseract.recognize(
                    img,  // The image element to be processed
                    'eng+khm',  // The languages to recognize (English and Khmer)
                    {
                        logger: (m) => console.log(m)  // Log progress (optional)
                    }
                ).then(({ data: { text } }) => {
                    // Display OCR result in the result container
                    document.getElementById("ocr-result").innerText = text;
                }).catch((err) => {
                    console.error("OCR Error:", err);
                    document.getElementById("ocr-result").innerText = "Error processing the image.";
                });
            };
            img.src = e.target.result;  // Load the image from the FileReader result
        };
        reader.readAsDataURL(file);  // Read the file as a data URL
    }
}
