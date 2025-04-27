import torch
from torchvision import models, transforms
from PIL import Image

# 1. Define model architecture
def load_model():
    # Load the MobileNetV2 model with pre-trained weights
    model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.DEFAULT)
    
    # Number of classes (6: Block A, Block B, ..., Block F)
    num_classes = 6  
    model.classifier[1] = torch.nn.Linear(model.classifier[1].in_features, num_classes)
    
    # Load the model weights
    model.load_state_dict(torch.load('models/model.pth', map_location=torch.device('cpu')), strict=False)
    
    # Set model to evaluation mode
    model.eval()
    
    return model


# 2. Image preprocessing for model prediction
def preprocess_image(image_path):
    # Open the image using PIL
    image = Image.open(image_path)
    
    # Define the image transformation (resize, normalize, convert to tensor)
    transform = transforms.Compose([
        transforms.Resize((224, 224)),  # Resize the image to 224x224 pixels
        transforms.ToTensor(),  # Convert image to tensor
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])  # Normalize based on ImageNet stats
    ])
    
    # Apply transformation to the image
    image = transform(image)
    
    return image.unsqueeze(0)  # Add a batch dimension


# 3. Predict landmark class
def predict_landmark(image_path):
    model = load_model()
    
    # Preprocess the image
    image = preprocess_image(image_path)
    
    # Make a prediction
    with torch.no_grad():
        outputs = model(image)
    
    # Get predicted class label (index of max probability)
    _, predicted_class = torch.max(outputs, 1)
    
    # Define class labels (corresponding to your 6 blocks)
    labels = ["Block A", "Block B", "Block C", "Block D", "Block E", "Block F"]
    
    # Return the predicted label
    return labels[predicted_class.item()]
