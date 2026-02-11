"""
REST Endpoints for Business Backend.
"""

import shutil
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Annotated

from aioinject import Inject
from aioinject.ext.fastapi import inject
from fastapi import APIRouter, UploadFile, File, HTTPException
from loguru import logger

from business_backend.ml.serving.inference_service import InferenceService

router = APIRouter()


@router.post("/detect")
@inject
async def detect_product(
    file: Annotated[UploadFile, File(...)],
    inference_service: Annotated[InferenceService, Inject],
):
    """
    Detect product in uploaded image.
    
    Uploads an image file and accepts it for processing by the ML Inference Service.
    """
    logger.info(f"📸 Received file for detection: {file.filename}")
    
    try:
        # Save uploaded file temporarily (to simulate real file processing)
        # In production, this might stream directly or save to S3
        suffix = Path(file.filename).suffix if file.filename else ".tmp"
        with NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            shutil.copyfileobj(file.file, tmp_file)
            tmp_path = tmp_file.name
            
        logger.debug(f"Saved temp file to: {tmp_path}")
        
        # Run inference
        result = await inference_service.predict(
            model_name="product_classifier",
            data=tmp_path,  # Passing file path
            preprocess=False # Our mock handles paths directly
        )
        
        # Cleanup
        Path(tmp_path).unlink(missing_ok=True)
        
        return {
            "status": "success",
            "filename": file.filename,
            "prediction": result.prediction,
            "confidence": result.confidence,
            "metadata": result.metadata
        }
        
    except Exception as e:
        logger.error(f"❌ Error in detection: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detect_video")
@inject
async def detect_video_product(
    file: Annotated[UploadFile, File(...)],
    inference_service: Annotated[InferenceService, Inject],
):
    """
    Detect product in uploaded video.
    
    Extracts a frame from the video and processes it as an image.
    """
    logger.info(f"🎥 Received video for detection: {file.filename}")
    
    video_path = None
    image_path = None
    
    try:
        # 1. Save video to temp file
        suffix = Path(file.filename).suffix if file.filename else ".mp4"
        with NamedTemporaryFile(delete=False, suffix=suffix) as tmp_video:
            shutil.copyfileobj(file.file, tmp_video)
            video_path = tmp_video.name
            
        logger.debug(f"Saved temp video to: {video_path}")
        
        # 2. Extract frame using OpenCV
        try:
            import cv2
        except ImportError:
            raise HTTPException(status_code=500, detail="OpenCV (cv2) not installed on server.")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
             raise HTTPException(status_code=400, detail="Could not open video file.")
             
        # Get total frame count to pick the middle one
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if frame_count > 0:
            middle_frame_index = max(0, frame_count // 2)
            cap.set(cv2.CAP_PROP_POS_FRAMES, middle_frame_index)
        
        ret, frame = cap.read()
        cap.release()
        
        # Fallback: if middle frame failed, try first frame
        if not ret:
             logger.warning("Could not read middle frame, trying start of video...")
             cap = cv2.VideoCapture(video_path)
             ret, frame = cap.read()
             cap.release()
        
        if not ret or frame is None:
             raise HTTPException(status_code=400, detail="Could not extract any frame from video.")

        # 3. Save frame as temp image
        with NamedTemporaryFile(delete=False, suffix=".jpg") as tmp_image:
            image_path = tmp_image.name
            
        cv2.imwrite(image_path, frame)
        logger.debug(f"Extracted frame saved to: {image_path}")
        
        # 4. Run inference on the image
        result = await inference_service.predict(
            model_name="product_classifier",
            data=image_path,
            preprocess=False
        )
        
        return {
            "status": "success",
            "filename": file.filename,
            "prediction": result.prediction,
            "confidence": result.confidence,
            "metadata": result.metadata
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in video detection: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        # Cleanup
        if video_path:
            Path(video_path).unlink(missing_ok=True)
        if image_path:
            Path(image_path).unlink(missing_ok=True)
