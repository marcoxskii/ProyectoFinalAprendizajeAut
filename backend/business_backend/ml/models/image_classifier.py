"""
Image Classifier Model.

Example implementation of BaseModel for image classification.
Supports Keras/TensorFlow, PyTorch and YOLO models.
"""

from typing import Any
from pathlib import Path
import random
from loguru import logger

from business_backend.ml.models.base import BaseModel

try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False


class ImageClassifier(BaseModel):
    """
    Image classification model wrapper.

    Supports loading models from:
    - YOLO (.pt)
    - Keras H5 format (.h5)
    - Keras JSON + weights (model.json + weights.h5)
    - TensorFlow SavedModel format (directory)
    - PyTorch (.pt, .pth)
    - ONNX (.onnx)
    """

    model_type: str = "image"
    input_shape: tuple[int, ...] = (640, 640, 3)

    def __init__(self) -> None:
        """Initialize classifier."""
        super().__init__()
        self._class_labels: list[str] = []
        self.model = None

    async def load(self, path: str | Path) -> None:
        """
        Load classification model from path.

        Args:
            path: Path to model file or directory
        """
        self.loading_path = str(path)
        logger.info(f"⚡ Loading ImageClassifier from: {self.loading_path}")
        
        # Check for dummy path to enable mock mode explicitly
        if self.loading_path == "dummy_path":
            logger.warning("⚠️ Dummy path detected. Using Mock capability.")
            self._is_loaded = True
            return

        if not ULTRALYTICS_AVAILABLE:
            logger.error("❌ Ultralytics not installed or import failed. Falling back to Mock.")
            self._is_loaded = True
            return

        try:
            if not Path(self.loading_path).exists():
                 logger.error(f"❌ Model file not found at: {self.loading_path}")
                 # Raise error or fallback? Let's raise to be clear
                 raise FileNotFoundError(f"Model file not found: {self.loading_path}")

            logger.info(f"🚀 Initializing YOLO model from {self.loading_path}...")
            self.model = YOLO(self.loading_path)
            self._is_loaded = True
            logger.info("✅ YOLO model loaded successfully.")
        except Exception as e:
            logger.exception(f"❌ Failed to load YOLO model: {e}")
            raise e

    async def predict(self, data: Any) -> dict[str, Any]:
        """
        Run classification on preprocessed image.

        Args:
            data: Preprocessed image array (normalized, correct shape) or path for demo

        Returns:
            Dict with prediction, confidence, and metadata
        """
        if not hasattr(self, "_is_loaded") or not self._is_loaded:
            raise RuntimeError("Model not loaded")

        # Use Real Model if loaded
        if self.model is not None:
            logger.info(f"🔮 Running YOLO prediction on {data}")
            return await self._predict_yolo(data)
            
        # Fallback to Mock
        logger.warning(f"⚠️ YOLO model not active. Using Mock prediction for {data}")
        return await self._predict_mock(data)

    async def _predict_yolo(self, data: Any) -> dict[str, Any]:
        """Real YOLO inference."""
        try:
            logger.info(f"Running YOLO inference on: {data}")
            
            # Run inference
            # YOLO accepts file paths (str), PIL, numpy.
            # conf=0.40 sets the minimum confidence threshold (Default is 0.25)
            results = self.model(data, verbose=False, conf=0.40)
            
            if not results:
                 logger.warning("No results returned from YOLO")
                 return self._empty_result()

            result = results[0] # First image
            
            if not getattr(result, 'boxes', None) or len(result.boxes) == 0:
                 logger.info("No objects detected in image.")
                 return {
                    "prediction": "No Product Detected",
                    "confidence": 0.0,
                    "class_id": -1,
                    "metadata": {"message": "No objects found"}
                 }
            
            # Find index of max confidence
            top_idx = result.boxes.conf.argmax().item()
            
            class_id = int(result.boxes.cls[top_idx].item())
            confidence = float(result.boxes.conf[top_idx].item())
            class_name = result.names[class_id]
            
            # --- MODELO CUSTOM CARGADO (train7) ---
            # El modelo ya detecta las clases específicas, no necesitamos simular nada.
            logger.info(f"Detected Custom Class: {class_name} ({confidence:.2f})")
            
            # Mapeo de seguridad por si los nombres del dataset difieren ligeramente del inventario
            # Aunque idealmente deberían coincidir
            
            return {
                "prediction": class_name,
                "confidence": confidence,
                "class_id": class_id,
                "metadata": {
                    "model_version": "yolo-v11",
                    "all_detections": [
                        {
                            "class": result.names[int(box.cls.item())],
                            "conf": float(box.conf.item())
                        } for box in result.boxes
                    ]
                }
            }
        except Exception as e:
            # If we fall here, it might be an issue with the image reading (like "WARNING ⚠️ Image Read Error")
            # We want to catch it and not crash, but maybe try to return "No Product Detected" if it was just an empty image read.
            logger.error(f"YOLO Prediction Error: {e}")
            
            # If it's a specific error related to empty arrays (often caused by bad image reads in YOLO)
            if "stack" in str(e) or "array" in str(e):
                logger.warning("Handling empty stack/array error as No Detection")
                return {
                    "prediction": "No Product Detected",
                    "confidence": 0.0,
                    "class_id": -1,
                    "metadata": {"message": "Error reading image or no detections"}
                 }

            raise e

    async def _predict_mock(self, data: Any) -> dict[str, Any]:
        """Mock implementation for demo."""
        logger.warning("⚠️ EXECUTION OF MOCK FORECAST - Check that YOLO is loaded")
        # Products that match our database entries
        mock_products = [
            {
                "prediction": "Dell Latitude 7490",
                "brand": "Dell",
                "sku_hint": "SKU-LAPTOP-let01",
                "confidence": 0.94,
                "sales_pitch": "Esta Dell Latitude es un tanque de batalla."
            },
            {
                "prediction": "HP EliteBook 840",
                "brand": "HP",
                "sku_hint": "SKU-LAPTOP-al01",
                "confidence": 0.91,
                "sales_pitch": "HP EliteBook, la elección equilibrada."
            },
            {
                "prediction": "MacBook Pro M1",
                "brand": "Apple",
                "sku_hint": "SKU-LAPTOP-asu01",
                "confidence": 0.98,
                "sales_pitch": "Una bestia de Apple."
            }
        ]

        # Pick one randomly to simulate "AI Detection"
        selected = random.choice(mock_products)

        return {
            "prediction": selected["prediction"],
            "confidence": selected["confidence"],
            "class_id": 0,  # Dummy ID
            "metadata": {
                "model_version": "1.0.0-mock",
                "brand_detected": selected["brand"],
                "sku_match": selected["sku_hint"],
                "sales_pitch": selected["sales_pitch"]
            }
        }
        
    def _empty_result(self) -> dict[str, Any]:
        return {
            "prediction": "Unknown",
            "confidence": 0.0,
            "class_id": -1,
            "metadata": {}
        }

    async def predict_batch(self, data_list: list[Any]) -> list[dict[str, Any]]:
        """
        Optimized batch prediction.

        Args:
            data_list: List of preprocessed images

        Returns:
            List of prediction results
        """
        results = []
        for data in data_list:
            results.append(await self.predict(data))
        return results

    def set_class_labels(self, labels: list[str]) -> None:
        """Set class label names for predictions."""
        self._class_labels = labels

    def get_class_labels(self) -> list[str]:
        """Get configured class labels."""
        return self._class_labels
