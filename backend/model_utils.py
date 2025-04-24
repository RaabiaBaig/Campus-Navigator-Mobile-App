import torch
import cv2
from torchvision import models, transforms
from PIL import Image

# Load landmark model
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.DEFAULT)
model.classifier[1] = torch.nn.Linear(model.classifier[1].in_features, 6)
model.load_state_dict(torch.load('models/model.pth', map_location=device))
model.to(device).eval()

label_mapping = {
    0: "Block A", 1: "Block B", 2: "Block C",
    3: "Block D", 4: "Block E", 5: "Block F",
}

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485,0.456,0.406], std=[0.229,0.224,0.225])
])

def predict_landmark(img):
    """Return predicted landmark label for an OpenCV BGR image."""
    pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    inp = transform(pil).unsqueeze(0).to(device)
    with torch.no_grad():
        out = model(inp)
        cls = torch.argmax(out, dim=1).item()
    return label_mapping.get(cls, "Unknown")
