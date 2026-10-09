"""Export the supplied, narrowly validated Keras CNN for the browser converter.

Run in an isolated Python environment with tensorflow-cpu==2.20.0,
keras==3.11.3, pillow==11.3.0. Never executes code from the supplied ZIP.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import zipfile

import numpy as np
from PIL import Image
from tensorflow import keras


EXPECTED_CLASSES = ["alto_riesgo", "bajo_riesgo", "muy_alto_riesgo", "muy_bajo_riesgo", "riesgo_moderado"]
EXPECTED_LAYERS = ["InputLayer", "Rescaling", "Conv2D", "MaxPooling2D", "Conv2D", "MaxPooling2D", "Conv2D", "GlobalAveragePooling2D", "Dense", "Dense"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("model", type=Path)
    parser.add_argument("classes", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    classes = json.loads(args.classes.read_text(encoding="utf-8-sig"))
    if classes != EXPECTED_CLASSES:
        raise ValueError("Output class order differs: explicitly review the integration before converting.")
    with zipfile.ZipFile(args.model) as archive:
        config = json.loads(archive.read("config.json"))
        layers = config["config"]["layers"]
        if config["class_name"] != "Sequential" or [layer["class_name"] for layer in layers] != EXPECTED_LAYERS:
            raise ValueError("Only the reviewed sequential CNN architecture is supported.")
        if layers[0]["config"]["batch_shape"] != [None, 128, 128, 3]:
            raise ValueError("Expected RGB 128 x 128 input.")
        scale = layers[1]["config"]
        if scale["offset"] != 0 or scale["scale"] != 1 / 255:
            raise ValueError("Unexpected input normalization.")
        for layer in layers:
            cfg = layer["config"]
            if layer["class_name"] in ("Conv2D", "MaxPooling2D", "GlobalAveragePooling2D") and cfg["data_format"] != "channels_last":
                raise ValueError("Expected channels_last.")
            if layer["class_name"] == "Conv2D" and (cfg["groups"] != 1 or cfg["dilation_rate"] != [1, 1]):
                raise ValueError("Unsupported convolution.")
    # Keras uses the filename suffix to select the reader; the supplied .zip IS a .keras archive.
    with tempfile.TemporaryDirectory(prefix="retincare-convert-") as temporary:
        source = Path(temporary) / "retincare.keras"
        shutil.copyfile(args.model, source)
        model = keras.models.load_model(source, compile=False, safe_mode=True)
    if model.output_shape != (None, 5):
        raise ValueError("Expected five output categories.")
    args.output.mkdir(parents=True, exist_ok=True)
    weights = model.get_weights()
    if not all(np.isfinite(weight).all() for weight in weights):
        raise ValueError("Non-finite model weights.")
    (args.output / "weights.bin").write_bytes(b"".join(weight.astype("<f4").tobytes() for weight in weights))
    descriptor = {
        "sourceSha256": hashlib.sha256(args.model.read_bytes()).hexdigest(),
        "classes": classes,
        "layers": layers[2:],
        "shapes": [list(weight.shape) for weight in weights],
        "sourceKerasVersion": json.loads(zipfile.ZipFile(args.model).read("metadata.json"))["keras_version"],
        "parameterCount": model.count_params(),
    }
    (args.output / "export.json").write_text(json.dumps(descriptor, indent=2), encoding="utf-8")
    # Deterministic, non-clinical inputs exercise the exact supplied preprocessing.
    fixtures = []
    for name, width, height, seed, constant in [
        ("black", 128, 128, 0, 0), ("white", 128, 128, 0, 255),
        ("rgb-pattern", 128, 128, 17, None), ("wide-nearest", 173, 91, 43, None),
        ("portrait-nearest", 79, 157, 97, None),
    ]:
        pixels = np.full((height, width, 3), constant, dtype=np.uint8) if constant is not None else ((np.arange(width * height * 3, dtype=np.uint32) * 37 + seed) % 256).astype(np.uint8).reshape(height, width, 3)
        # load_img(... target_size=(128,128)) defaults to PIL nearest, no /255 here.
        resized = np.asarray(Image.fromarray(pixels).resize((128, 128), Image.Resampling.NEAREST), dtype=np.float32)
        output = model(np.expand_dims(resized, 0), training=False).numpy()[0].tolist()
        fixtures.append({"name": name, "width": width, "height": height, "seed": seed, "constant": constant, "expectedScores": output,
                         "resizedSha256": hashlib.sha256(resized.astype(np.uint8).tobytes()).hexdigest()})
    (args.output / "parity.json").write_text(json.dumps({"sourceSha256": descriptor["sourceSha256"], "fixtures": fixtures}, indent=2), encoding="utf-8")
    print(json.dumps({"sourceSha256": descriptor["sourceSha256"], "parameters": model.count_params(), "weightBytes": (args.output / "weights.bin").stat().st_size, "fixtures": len(fixtures)}))


if __name__ == "__main__":
    main()
