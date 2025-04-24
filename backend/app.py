from flask import Flask, request, jsonify
import cv2, numpy as np, json
from model_utils import predict_landmark
from distance_utils import estimate_distance
from loc_utils import trilaterate

app = Flask(__name__)
lm_pos = json.load(open("static/landmark_positions.json"))

@app.route('/predict', methods=['POST'])
def predict():
    left=request.files.get('left'); right=request.files.get('right')
    if not left or not right:
        return jsonify({'error':'Send both images'}),400
    l=cv2.imdecode(np.frombuffer(left.read(),np.uint8),cv2.IMREAD_COLOR)
    r=cv2.imdecode(np.frombuffer(right.read(),np.uint8),cv2.IMREAD_COLOR)
    lm=predict_landmark(l); dist=estimate_distance(l,r)
    return jsonify({"landmark":lm,"distance":dist})

@app.route('/locate', methods=['POST'])
def locate():
    readings=request.get_json()['readings']
    pts=[lm_pos[r['landmark']] for r in readings]
    ds=[r['distance'] for r in readings]
    x,y=trilaterate(pts[0],ds[0],pts[1],ds[1],pts[2],ds[2])
    return jsonify({"x":x,"y":y})

if __name__=='__main__':
    app.run(debug=True)
