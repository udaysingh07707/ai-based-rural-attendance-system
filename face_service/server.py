"""Private, memory-only YuNet + SFace inference endpoint."""

import hmac
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import cv2
import numpy as np
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

MAX_IMAGE_BYTES = int(os.getenv("FACE_MAX_IMAGE_BYTES", str(10 * 1024 * 1024)))
MAX_IMAGE_PIXELS = int(os.getenv("FACE_MAX_IMAGE_PIXELS", "40000000"))
MODEL_VERSION = os.getenv("FACE_MODEL_VERSION", "opencv-zoo-yunet-2023mar-sface-2021dec")
SERVICE_TOKEN = os.environ.get("FACE_SERVICE_TOKEN", "")
DETECTION_SCORE_THRESHOLD = float(os.getenv("FACE_DETECTION_SCORE_THRESHOLD", "0.5"))
DETECTOR_PATH = os.environ.get("YUNET_MODEL_PATH", str(BASE_DIR / "models/face_detection_yunet_2023mar.onnx"))
RECOGNIZER_PATH = os.environ.get("SFACE_MODEL_PATH", str(BASE_DIR / "models/face_recognition_sface_2021dec.onnx"))

if not SERVICE_TOKEN:
    raise RuntimeError("FACE_SERVICE_TOKEN must be configured")
if not 0 < DETECTION_SCORE_THRESHOLD <= 1:
    raise RuntimeError("FACE_DETECTION_SCORE_THRESHOLD must be greater than 0 and at most 1")
if not os.path.isfile(DETECTOR_PATH) or not os.path.isfile(RECOGNIZER_PATH):
    raise RuntimeError("YuNet and SFace model files must be installed before starting the service")

detector = cv2.FaceDetectorYN.create(DETECTOR_PATH, "", (320, 320), DETECTION_SCORE_THRESHOLD, 0.3, 5000)
recognizer = cv2.FaceRecognizerSF.create(RECOGNIZER_PATH, "")
inference_lock = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    server_version = "PrivateFaceInference/1"

    def log_message(self, _format, *_args):
        # Request bodies, image names, detections, and embeddings must not enter logs.
        return

    def send_json(self, status, payload):
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path != "/healthz":
            self.send_json(404, {"error": "Not found."})
            return
        self.send_json(200, {"ready": True, "modelVersion": MODEL_VERSION})

    def do_POST(self):
        if self.path != "/v1/embeddings":
            self.send_json(404, {"error": "Not found."})
            return
        supplied = self.headers.get("Authorization", "")
        expected = f"Bearer {SERVICE_TOKEN}"
        if not hmac.compare_digest(supplied, expected):
            self.send_json(401, {"error": "Unauthorized."})
            return
        if self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower() not in {
            "image/jpeg", "image/png", "image/webp"
        }:
            self.send_json(415, {"error": "Unsupported image type."})
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"error": "Invalid request size."})
            return
        if content_length <= 0 or content_length > MAX_IMAGE_BYTES:
            self.send_json(413, {"error": "Image is empty or exceeds the size limit."})
            return

        raw = self.rfile.read(content_length)
        if len(raw) != content_length:
            self.send_json(400, {"error": "Incomplete image upload."})
            return
        encoded = np.frombuffer(raw, dtype=np.uint8)
        image = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
        del raw, encoded
        if image is None or image.size == 0:
            self.send_json(400, {"error": "Image could not be decoded."})
            return
        height, width = image.shape[:2]
        if width * height > MAX_IMAGE_PIXELS:
            del image
            self.send_json(413, {"error": "Image dimensions exceed the processing limit."})
            return

        try:
            with inference_lock:
                detector.setInputSize((width, height))
                _status, faces = detector.detect(image)
                results = []
                if faces is not None:
                    for face in faces:
                        aligned = recognizer.alignCrop(image, face)
                        feature = recognizer.feature(aligned).reshape(-1).astype(np.float32)
                        results.append({
                            "box": [round(float(value), 2) for value in face[:4]],
                            "detectionScore": round(float(face[-1]), 5),
                            "embedding": [round(float(value), 8) for value in feature],
                        })
                        del aligned, feature
            self.send_json(200, {"modelVersion": MODEL_VERSION, "imageWidth": width, "imageHeight": height, "faces": results})
        except Exception:
            self.send_json(422, {"error": "Image inference failed."})
        finally:
            del image


if __name__ == "__main__":
    host = os.getenv("FACE_SERVICE_HOST", "127.0.0.1")
    port = int(os.getenv("FACE_SERVICE_PORT", "8765"))
    ThreadingHTTPServer((host, port), Handler).serve_forever()
