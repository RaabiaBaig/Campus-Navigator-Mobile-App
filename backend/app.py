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
import cv2
import numpy as np
import json
from trilateration import TrilaterationCalculator

app = Flask(__name__)
CORS(app)
# Initialize trilateration calculator
trilaterator = TrilaterationCalculator()
# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Constants for distance calculation
FOCAL_LENGTH = 700  # in pixels
BASELINE = 1.0      # in meters

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

# Load YOLOv5 for object detection
def load_yolo():
    logger.debug("Loading YOLOv5 model...")
    yolo = torch.hub.load('ultralytics/yolov5', 'yolov5l', trust_repo=True)
    logger.debug("YOLOv5 model loaded")
    return yolo

model = load_model()
yolo = load_yolo()

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

@app.route('/detect-block', methods=['POST'])
def detect_block():
    try:
        logger.debug("Received request at /detect-block")
        
        if 'image' not in request.files:
            logger.error("No image provided in request")
            return jsonify({'error': 'No image provided'}), 400
        
        image_file = request.files['image']
        logger.debug(f"Received image file: {image_file.filename}")
        
        filename = secure_filename(image_file.filename)
        if not filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            return jsonify({'error': 'Invalid file type'}), 400
        
        img_bytes = image_file.read()
        logger.debug(f"Image size: {len(img_bytes)} bytes")
        
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        logger.debug(f"Image dimensions: {img.size}")
        
        img_tensor = transform(img).unsqueeze(0)
        logger.debug(f"Tensor shape: {img_tensor.shape}")
        
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

@app.route('/calculate-distance', methods=['POST'])
def calculate_distance():
    try:
        logger.debug("Received request at /calculate-distance")
        
        if 'images' not in request.files or len(request.files.getlist('images')) != 2:
            return jsonify({'error': 'Please upload exactly two images'}), 400
        
        if 'prediction' not in request.form:
            return jsonify({'error': 'Missing prediction data'}), 400
        
        prediction = json.loads(request.form['prediction'])
        
        # Process both images
        images = []
        for file in request.files.getlist('images'):
            img_bytes = file.read()
            img_np = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(img_np, cv2.IMREAD_COLOR)
            images.append(img)
        
        img1, img2 = images
        height, width = img1.shape[:2]
        
        # Detect objects in both images
        def detect_objects(img):
            results = yolo(img)
            detections = results.xyxy[0].cpu().numpy()
            objects = []
            for det in detections:
                x1, y1, x2, y2, conf, cls_id = det
                x1, y1, x2, y2 = map(int, [x1, y1, x2, y2])
                center_x = (x1 + x2) / 2
                label = yolo.names[int(cls_id)]
                objects.append({
                    "center_x": center_x,
                    "bbox": (x1, y1, x2, y2),
                    "label": label,
                    "confidence": conf,
                    "cropped": img[y1:y2, x1:x2]
                })
            return objects
        
        objects1 = detect_objects(img1)
        objects2 = detect_objects(img2)
        
        # Find common objects with highest confidence
        common_labels = set(obj['label'] for obj in objects1) & set(obj['label'] for obj in objects2)
        best_match = None
        max_matches = 0
        
        for label in common_labels:
            if label == "person":
                continue  # Skip people
                
            objs1 = [obj for obj in objects1 if obj['label'] == label]
            objs2 = [obj for obj in objects2 if obj['label'] == label]
            
            for o1 in objs1:
                for o2 in objs2:
                    # ORB feature matching
                    orb = cv2.ORB_create(nfeatures=1000)
                    kp1, des1 = orb.detectAndCompute(cv2.cvtColor(o1['cropped'], cv2.COLOR_BGR2GRAY), None)
                    kp2, des2 = orb.detectAndCompute(cv2.cvtColor(o2['cropped'], cv2.COLOR_BGR2GRAY), None)
                    
                    if des1 is not None and des2 is not None:
                        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
                        matches = bf.match(des1, des2)
                        if len(matches) > max_matches:
                            max_matches = len(matches)
                            best_match = (o1, o2)
        
        if not best_match:
            return jsonify({'status': 'error', 'message': 'No matching objects found'}), 400
        
        o1, o2 = best_match
        
        # Calculate distance using triangulation
        def estimate_distance(x1, x2, img_width, focal_length, baseline):
            cx = img_width / 2
            theta1 = np.arctan((x1 - cx) / focal_length)
            theta2 = np.arctan((x2 - cx) / focal_length)
            
            if abs(np.tan(theta1) - np.tan(theta2)) < 1e-5:
                return None
                
            distance = abs(baseline / (np.tan(theta1) - np.tan(theta2)))
            return distance
        
        distance = estimate_distance(o1['center_x'], o2['center_x'], width, FOCAL_LENGTH, BASELINE)
        
        if distance is None:
            return jsonify({'status': 'error', 'message': 'Could not calculate distance'}), 400
        
        return jsonify({
            "status": "success",
            "matched_object": o1['label'],
            "distance": distance,
            "orb_matches": max_matches,
            "block": prediction['block']
        })
        
    except Exception as e:
        logger.error(f"Error calculating distance: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500
@app.route('/calculate-position', methods=['POST'])
def calculate_position():
    try:
        logger.debug("Received request at /calculate-position")
        
        if not request.json or 'measurements' not in request.json:
            logger.error("Missing measurements data")
            return jsonify({'error': 'Missing measurements data'}), 400
        
        measurements = request.json['measurements']
        logger.debug(f"Received measurements: {measurements}")
        
        result = trilaterator.calculate_position_with_confidence(measurements)
        
        if 'error' in result:
            logger.error(f"Trilateration error: {result['error']}")
            return jsonify({
                'status': 'error',
                'message': result['error'],
                'used_landmarks': result['used_landmarks']
            }), 400
        
        logger.info(f"Position calculated: {result['position']} with error {result['error_estimate']}")
        return jsonify({
            'status': 'success',
            'position': result['position'],
            'error_estimate': result['error_estimate'],
            'used_landmarks': result['used_landmarks']
        })
        
    except Exception as e:
        logger.error(f"Error calculating position: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
@app.route('/test', methods=['GET'])
def test():
    return jsonify({"status": "success", "message": "Server is running"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)