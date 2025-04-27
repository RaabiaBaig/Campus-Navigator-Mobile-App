from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
from torchvision import models
import torchvision.transforms as transforms
from PIL import Image
import io
import os
import logging
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Model setup
def load_model():
    logger.debug("Loading model...")
    model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.DEFAULT)
    num_classes = 6
    model.classifier[1] = torch.nn.Linear(model.classifier[1].in_features, num_classes)
    
    model_path = os.path.join('models', 'model.pth')
    logger.debug(f"Loading model weights from: {model_path}")
    model.load_state_dict(torch.load(model_path, map_location=torch.device('cpu')))
    model.eval()
    logger.debug("Model loaded successfully")
    return model

model = load_model()

# Label mapping
label_mapping = {
    0: "Block A",
    1: "Block B",
    2: "Block C",
    3: "Block D",
    4: "Block E",
    5: "Block F"
}

# Image transformations
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

@app.before_request
def log_request_info():
    logger.debug(f"Headers: {request.headers}")
    if request.files:
        logger.debug(f"Received files: {request.files}")
    else:
        logger.debug("No files in request")

@app.route('/detect-block', methods=['POST'])
def detect_block():
    try:
        logger.debug("Received request at /detect-block")
        
        if 'image' not in request.files:
            logger.error("No image provided in request")
            return jsonify({'error': 'No image provided'}), 400
        
        image_file = request.files['image']
        logger.debug(f"Received image file: {image_file.filename}")
        
        # Secure the filename and verify it's allowed
        filename = secure_filename(image_file.filename)
        if not filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            return jsonify({'error': 'Invalid file type'}), 400
        
        img_bytes = image_file.read()
        logger.debug(f"Image size: {len(img_bytes)} bytes")
        
        # Convert bytes to PIL Image
        logger.debug("Converting image bytes to PIL Image")
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        logger.debug(f"Image dimensions: {img.size}")
        
        # Apply transformations
        logger.debug("Applying image transformations")
        img_tensor = transform(img).unsqueeze(0)
        logger.debug(f"Tensor shape: {img_tensor.shape}")
        
        # Predict
        logger.debug("Running model prediction")
        with torch.no_grad():
            output = model(img_tensor)
            predicted_class = torch.argmax(output, dim=1).item()
        
        predicted_label = label_mapping.get(predicted_class, "Unknown")
        confidence = torch.max(torch.softmax(output, dim=1)).item()
        logger.debug(f"Prediction result - Block: {predicted_label}, Confidence: {confidence:.2f}")
        
        return jsonify({
            "status": "success",
            "block": predicted_label,
            "confidence": confidence
        })
        
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/test', methods=['GET'])
def test():
    logger.debug("Test endpoint hit")
    return jsonify({"status": "success", "message": "Server is running"})

if __name__ == '__main__':
    logger.debug("Starting Flask server")
    app.run(host='0.0.0.0', port=5000, debug=True)