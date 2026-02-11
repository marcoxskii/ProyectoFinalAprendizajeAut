
from ultralytics import YOLO
import sys

try:
    print("Loading NEW reconstructed model...")
    model = YOLO("/home/mkt/Projects/Aprendizaje/ProyectoFinalAprendizaje/business_backend/ml/weights/best.pt")
    print(f"✅ Model Loaded Successfully. Classes: {model.names}")
except Exception as e:
    print(f"❌ Error loading model: {e}")
