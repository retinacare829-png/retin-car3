# Modelo aportado por el equipo

- `retincare.keras`: copia binaria, sin modificar, de `retincare.keras.zip` entregado por el usuario. El ZIP ya era un archivo Keras; no se ejecutaron repositorios ni scripts adjuntos.
- SHA-256: `2e86c30216fdb012343282e54084b8ae06e5337ad45f287b29c2f573a6141917`.
- Metadatos originales: Keras 3.11.3, guardado `2026-10-08@22:20:53`.
- Arquitectura: RGB 128×128 → Rescaling(1/255) → Conv16/Pool → Conv32/Pool → Conv64 → GlobalAveragePooling → Dense64 → Dense5 softmax. 28.069 parámetros.
- `classes.json`: orden original de las cinco salidas; no ordenar alfabéticamente ni por gravedad.
- Los pesos publicados para inferencia pesan 112.276 bytes; no incluyen el optimizador.

El archivo de prueba adjunto carga la imagen con Keras `load_img(..., target_size=(128,128), color_mode="rgb")`, convierte a array y llama a `predict`, sin normalización externa. Se conserva ese contrato. No se entregaron datos de entrenamiento ni métricas de evaluación; no se acredita precisión médica.

Conversión reproducible, pruebas y limitaciones: [Integración CNN](../../docs/INTEGRACION_CNN.md).
