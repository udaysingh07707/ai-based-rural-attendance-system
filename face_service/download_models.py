"""Fetch pinned OpenCV Zoo ONNX models and verify their SHA-256 digests."""

import hashlib
import os
import urllib.request
from pathlib import Path

MODEL_DIR = Path(__file__).parent / "models"
MODELS = {
    "face_detection_yunet_2023mar.onnx": (
        "https://github.com/opencv/opencv_zoo/raw/refs/heads/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4",
    ),
    "face_recognition_sface_2021dec.onnx": (
        "https://github.com/opencv/opencv_zoo/raw/refs/heads/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
        "0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79",
    ),
}


def digest(path):
    checksum = hashlib.sha256()
    with path.open("rb") as model_file:
        for chunk in iter(lambda: model_file.read(1024 * 1024), b""):
            checksum.update(chunk)
    return checksum.hexdigest()


def main():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    for name, (url, expected) in MODELS.items():
        target = MODEL_DIR / name
        if target.exists() and digest(target) == expected:
            print(f"verified {name}")
            continue
        temporary = target.with_suffix(target.suffix + ".download")
        request = urllib.request.Request(url, headers={"User-Agent": "school-attendance-model-setup/1"})
        with urllib.request.urlopen(request, timeout=120) as response, temporary.open("wb") as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
        actual = digest(temporary)
        if actual != expected:
            temporary.unlink(missing_ok=True)
            raise RuntimeError(f"SHA-256 mismatch for {name}: received {actual}")
        os.replace(temporary, target)
        print(f"downloaded and verified {name}")


if __name__ == "__main__":
    main()
