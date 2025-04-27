import torch
import cv2
import numpy as np

# Load YOLOv5
yolo = torch.hub.load('ultralytics/yolov5', 'yolov5l', source='github', trust_repo=True)
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
yolo.to(device)

FOCAL_LENGTH = 700
BASELINE = 1.0

def detect_objects_cv(image):
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    results = yolo(rgb)
    dets = results.xyxy[0].cpu().numpy()
    objs = []
    for x1,y1,x2,y2,_,cls in dets:
        x1,y1,x2,y2 = map(int,(x1,y1,x2,y2))
        objs.append({
            "center_x": (x1 + x2)/2,
            "bbox": (x1,y1,x2,y2),
            "label": yolo.names[int(cls)],
            "cropped": image[y1:y2, x1:x2]
        })
    return objs

def orb_match(img1, img2):
    orb = cv2.ORB_create(nfeatures=1000)
    kp1,des1 = orb.detectAndCompute(cv2.cvtColor(img1,cv2.COLOR_BGR2GRAY),None)
    kp2,des2 = orb.detectAndCompute(cv2.cvtColor(img2,cv2.COLOR_BGR2GRAY),None)
    if des1 is None or des2 is None: return 0
    return len(cv2.BFMatcher(cv2.NORM_HAMMING,crossCheck=True).match(des1,des2))

def estimate_distance(left_img, right_img):
    objs1 = detect_objects_cv(left_img)
    objs2 = detect_objects_cv(right_img)
    best, max_m = None, 0
    for o1 in objs1:
        for o2 in objs2:
            if o1["label"]!=o2["label"] or o1["label"]=="person": continue
            m = orb_match(o1["cropped"], o2["cropped"])
            if m>max_m: best, max_m = (o1,o2), m
    if not best: return None

    o1,o2 = best
    x1,x2 = o1["center_x"], o2["center_x"]
    width = left_img.shape[1]
    cx = width/2

    theta1 = np.arctan((x1-cx)/FOCAL_LENGTH)
    theta2 = np.arctan((x2-cx)/FOCAL_LENGTH)
    if abs(np.tan(theta1)-np.tan(theta2))<1e-5: return None

    dist = abs(BASELINE/(np.tan(theta1)-np.tan(theta2)))
    return round(dist,2)
