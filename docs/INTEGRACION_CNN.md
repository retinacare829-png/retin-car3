# Integración experimental de la CNN de RetinaCare

La aplicación integra el modelo suministrado en `models/retincare/retincare.keras`. La versión identificada en la interfaz es `RetinCare CNN · 2026-10-08`. Esta integración ejecuta inferencia real con los pesos convertidos; sus resultados son experimentales y requieren revisión profesional.

## Ruta en la interfaz

1. Abra un paciente y su sección **Screenings e imágenes**.
2. Seleccione un expediente y, en **Captura y calidad**, la imagen activa del ojo **OD** u **OI**.
3. Revise la calidad de la captura. El panel **Análisis de imagen con CNN** aparece para usuarios con permiso de acceso a la descarga de imágenes.
4. Pulse **Analizar OD** o **Analizar OI**. Cada intento solicita una URL firmada nueva para la imagen seleccionada.
5. Revise la **Categoría sugerida por el modelo** y las cinco puntuaciones relativas. Un error permite **Reintentar análisis**.

Sin imagen activa, el botón está deshabilitado. La calidad `INADECUADA` bloquea el análisis y solicita repetir la captura. `PENDIENTE` permite la ejecución con una advertencia visible; no equivale a una aprobación de calidad.

El resultado pertenece únicamente a la imagen y al estado de calidad analizados. Cambiar imagen, expediente, organización, ruta de almacenamiento, fecha de actualización, lateralidad, paciente, estado de la imagen o calidad descarta el resultado. También se descarta al desmontar el panel. Las solicitudes pendientes se abortan y las respuestas o avisos tardíos se ignoran. Volver a una imagen anterior no recupera su resultado. Un cambio de URL de vista previa o un nuevo objeto con los mismos datos de identidad no invalida por sí solo el resultado.

## Ejecución en el navegador y privacidad

Los pesos convertidos son recursos públicos de la web: quien acceda a la aplicación puede descargarlos. Esto no hace públicas las imágenes ni los expedientes, que mantienen su acceso autorizado. Si en el futuro se requiere mantener privados los pesos, la inferencia deberá trasladarse a un servicio autenticado.

`RetinalAnalysisPanel` llama a `analyzeRetinalImage` únicamente por una acción del usuario. El servicio importa dinámicamente `retinalInferenceRuntime`; TensorFlow.js y el modelo no se inicializan al abrir el panel. El motor descarga `models/retincare-v1/model.json` y sus pesos desde los recursos estáticos de la aplicación y conserva el modelo cargado en memoria para reutilizarlo. Intenta WebGL y dispone de ejecución CPU como alternativa.

La imagen se descarga del almacenamiento autorizado mediante la URL firmada existente y se procesa en el navegador. Esta ruta de inferencia no envía imágenes a un nuevo servidor de IA ni a un proveedor externo de inferencia. La obtención de la URL, la descarga de la imagen y la descarga inicial del modelo sí requieren solicitudes de red: esta característica no significa que el sistema completo funcione sin conexión ni que la imagen deje de estar almacenada en el servicio existente.

El motor solicita la imagen con `cache: "no-store"`. El panel muestra las indicaciones controladas de `RetinalInferenceError`, por ejemplo usar una captura opaca, reducir su resolución o volver a abrir el expediente. Para errores desconocidos utiliza un mensaje genérico sin URLs firmadas ni detalles internos. Los resultados permanecen en el estado temporal de React: no se guardan automáticamente en la base de datos, no modifican la evaluación clínica, no generan un informe clínico y no se publican automáticamente en el portal del paciente. Cerrar el panel o recargar la página elimina esos resultados de la interfaz.

## Entrada y normalización

El contrato de entrada es RGB, `128 × 128` píxeles, con tensor `[1, 128, 128, 3]` y canales en el último eje. El redimensionado utiliza vecino más cercano (**nearest**) con muestreo centrado compatible con PIL. No añade recortes, realce ni transformaciones de aumento de datos. La ruta actual acepta imágenes opacas JPEG, PNG o WebP dentro de los límites de tamaño y resolución del motor.

La normalización por `1/255` se aplica **exactamente una vez**:

- En el modelo Keras original, la capa `Rescaling(1/255)` está incluida. Al probar ese modelo se entregan valores RGB en el rango `0–255`, sin división previa.
- La exportación omite esa capa de la topología destinada a TensorFlow.js. El navegador crea el tensor `float32` a partir de RGB `0–255` y multiplica por `1/255` una sola vez antes de `predict`.

No se debe añadir otra división en la lectura de imagen, en `resizeRetinalRgb`, en el panel o en la topología convertida. Duplicarla cambiaría la entrada efectiva del modelo.

## Orden exacto de las salidas

El índice de salida determina la categoría. El orden procede de `models/retincare/classes.json` y debe coincidir con `RETINAL_CLASSES`, la exportación y los metadatos del modelo web; **no está ordenado por gravedad clínica**.

| Índice | Clase | Etiqueta mostrada |
| --- | --- | --- |
| 0 | `alto_riesgo` | Alto riesgo |
| 1 | `bajo_riesgo` | Bajo riesgo |
| 2 | `muy_alto_riesgo` | Muy alto riesgo |
| 3 | `muy_bajo_riesgo` | Muy bajo riesgo |
| 4 | `riesgo_moderado` | Riesgo moderado |

La categoría sugerida corresponde a la puntuación mayor. La interfaz presenta las cinco puntuaciones relativas en la escala `0–1`, sin describirlas como probabilidad clínica, confianza clínica ni exactitud diagnóstica. Los nombres de las clases son etiquetas del modelo, no una valoración médica automática del paciente.

## Reproducir la exportación y conversión

Ejecute los comandos desde la raíz del repositorio. Se necesita Node.js con las dependencias del proyecto instaladas y Python compatible con las versiones fijadas. El siguiente ejemplo para PowerShell utiliza Python 3.12 y un entorno virtual aislado en el directorio temporal del usuario; no instala TensorFlow en el Python global. Si Python 3.12 no está registrado en `py`, use la ruta absoluta a su intérprete 3.12.

```powershell
Set-Location C:/Users/Mayno/Documents/RetinaCare
$cnnEnvironment = Join-Path $env:TEMP "retincare-cnn-python"
$cnnExport = Join-Path $env:TEMP "retincare-cnn-export"
py -3.12 -m venv $cnnEnvironment
$cnnPython = Join-Path $cnnEnvironment "Scripts/python.exe"
& $cnnPython -m pip install "tensorflow-cpu==2.20.0" "keras==3.11.3" "pillow==11.3.0"

& $cnnPython scripts/export-retincare-model.py models/retincare/retincare.keras models/retincare/classes.json $cnnExport
node scripts/convert-retincare-model.mjs $cnnExport public/models/retincare-v1
```

Si aún faltan las dependencias JavaScript del proyecto, instálelas con `npm ci` antes de ejecutar el conversor. Si un comando falla, corrija el error antes de continuar al siguiente.

El exportador valida la arquitectura secuencial admitida, la forma de entrada, las cinco salidas, el orden de clases y la normalización del archivo suministrado. Usa `load_model(..., compile=False, safe_mode=True)` y genera en `$cnnExport`:

- `export.json`: capas exportadas, formas de pesos, clases y SHA-256 del modelo fuente.
- `weights.bin`: pesos en `float32` little-endian.
- `parity.json`: cinco entradas sintéticas deterministas, salidas originales Keras y hashes del redimensionado PIL.

El conversor reconstruye las capas admitidas con TensorFlow.js y escribe `model.json`, `weights.bin` y `classes.json` en `public/models/retincare-v1`. Repetir la conversión sobrescribe esos tres artefactos en el destino indicado. No reentrena el modelo. Cambiar de arquitectura, clases o normalización requiere revisar la integración, no solo reemplazar el archivo fuente.

## Verificación y límites de la evidencia

Las comprobaciones se pueden ejecutar por separado:

```powershell
npm run typecheck
npm test -- src/components/RetinalAnalysisPanel.test.tsx
npm test -- src/services/retinalModelParity.test.ts
```

La prueba del panel simula el servicio para verificar interacción, selección, errores, reintentos, cancelación y descarte de resultados obsoletos. No mide la calidad del modelo ni sustituye una prueba real en navegador.

La prueba de paridad utiliza `src/test/fixtures/retinal-model-parity.json`, generado a partir de `parity.json` del exportador para el mismo modelo fuente. Comprueba hashes del modelo y pesos, hashes exactos del redimensionado PIL y diferencias absolutas de salida inferiores a `1e-4` frente a Keras. Para regenerar referencias debe revisarse expresamente el `parity.json` exportado y su correspondencia con el modelo fuente antes de actualizar la fixture del repositorio.

En la integración del 9 de octubre de 2026, el responsable de la integración confirmó cinco fixtures aprobadas: `black`, `white`, `rgb-pattern`, `wide-nearest` y `portrait-nearest`, con hashes PIL exactos y salidas TensorFlow.js dentro de `1e-4` respecto al original. Esto documenta equivalencia técnica sobre esas entradas sintéticas; no acredita equivalencia para todos los formatos de imagen, todos los navegadores o todos los dispositivos. La comprobación real en navegador se realiza por separado.

No se proporcionaron métricas de entrenamiento o evaluación del modelo, como exactitud, sensibilidad, especificidad, AUC o calibración, ni evidencia de validación clínica. No se atribuyen cifras de desempeño a este modelo. La conversión, la paridad numérica y las pruebas de interfaz no constituyen validación clínica. El módulo sigue siendo experimental y no debe presentarse como diagnóstico, informe clínico o sistema clínicamente validado.

### Comprobación de integración — 9 de octubre de 2026

- 131 pruebas aprobadas en 28 archivos (`npm test -- --maxWorkers=2`); limitar trabajadores evitó saturar esta PC y los timeouts de ejecución paralela. Lint y compilación local/demo aprobados.
- Ejecución real en Brave, sesión de administrador de demostración, imagen OD ya existente: cinco puntuaciones obtenidas del modelo, sin guardar ni publicar datos clínicos. Una segunda ejecución con el modelo cargado tardó aproximadamente 0,1 s en esa PC; no es una garantía para otros equipos.
- Al seleccionar OI se descartó el resultado de OD y se bloqueó el análisis por calidad inadecuada. El recurso de ejemplo OI ya faltaba en Storage; no se modificó ni se sustituyó por una imagen ficticia.
- Vista de 390×844 y escritorio verificadas: panel sin desbordamiento horizontal. Esto es una prueba de viewport móvil, no una prueba en teléfono físico.
- Modelo y pesos servidos correctamente por el servidor de demo en el puerto 4173; bundle de demo conectado al proyecto hospedado. No se realizaron migraciones ni cambios de permisos.
- Vite advierte que el chunk de inferencia supera 500 kB (unos 244 kB comprimidos). Es una carga diferida al analizar, no en login; la advertencia no se ha ocultado.
- Las puntuaciones de la imagen OD fueron próximas entre sí (aproximadamente 0,178–0,219). El máximo no constituye evidencia suficiente de riesgo clínico; hacen falta evaluación del conjunto de prueba, calibración y validación profesional antes de cualquier uso asistencial real.

Los navegadores y PIL pueden decodificar formatos comprimidos, perfiles de color y orientación EXIF de manera diferente. Las pruebas de paridad verifican los píxeles RGB sintéticos y el redimensionado, no todos los decodificadores. Use capturas opacas sin orientación EXIF especial; se rechazan transparencias y capturas de más de 16 megapíxeles.
