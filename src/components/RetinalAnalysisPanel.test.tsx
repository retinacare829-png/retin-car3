import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RetinalImage } from "../domain/screening";
import { RETINAL_CLASSES, RETINAL_MODEL_VERSION, retinalClassLabels, type RetinalPrediction } from "../domain/retinalModel";
import { analyzeRetinalImage, RetinalInferenceError } from "../services/retinalInferenceService";
import { RetinalAnalysisPanel } from "./RetinalAnalysisPanel";
import type { RetinalReportService } from "../services/retinalReportService";

vi.mock("../services/retinalInferenceService", async (importOriginal) => ({
  ...await importOriginal<typeof import("../services/retinalInferenceService")>(),
  analyzeRetinalImage: vi.fn(),
}));

const image: RetinalImage = {
  id: "image-od", organizationId: "organization-1", screeningId: "screening-1", patientId: "patient-1",
  laterality: "OD", storagePath: "organization-1/screening-1/od.png", updatedAt: "2026-10-09T12:00:00Z",
  createdAt: "2026-10-09T12:00:00Z", capturedAt: "2026-10-09T12:00:00Z", uploadedBy: null,
  originalFileName: "od.png", mimeType: "image/png", sizeBytes: 100, hashSha256: null,
  status: "ACTIVA", replacedByImageId: null, deletedAt: null, deletedBy: null,
  signedUrl: "https://example.test/stale-signed-url",
};

function prediction(selected = image): RetinalPrediction {
  return {
    imageId: selected.id, organizationId: selected.organizationId, screeningId: selected.screeningId,
    laterality: selected.laterality, modelVersion: RETINAL_MODEL_VERSION, generatedAt: "2026-10-09T12:01:00Z",
    predictedClass: RETINAL_CLASSES[2], predictedLabel: retinalClassLabels[RETINAL_CLASSES[2]], elapsedMs: 1250,
    scores: RETINAL_CLASSES.map((className, index) => ({
      className, label: retinalClassLabels[className], score: index === 2 ? 0.6 : 0.1,
    })),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const infer = vi.mocked(analyzeRetinalImage);
const getImageUrl = vi.fn<(selected: RetinalImage) => Promise<string>>();

function inferenceRequest(index = 0) {
  const call = infer.mock.calls[index];
  if (!call) throw new Error(`Missing inference call ${index}`);
  return call[0];
}

beforeEach(() => {
  vi.resetAllMocks();
  getImageUrl.mockResolvedValue("https://example.test/fresh-signed-url");
  infer.mockResolvedValue(prediction());
});
afterEach(cleanup);

describe("RetinalAnalysisPanel", () => {
  it("no presenta puntuaciones casi uniformes como diagnóstico de muy alto riesgo", async () => {
    const output = prediction();
    output.scores = output.scores.map((score, index) => ({ ...score, score: index === 2 ? 0.22 : 0.195 }));
    infer.mockResolvedValue(output);
    render(<RetinalAnalysisPanel image={image} qualityStatus="ADECUADA" getImageUrl={getImageUrl} />);
    fireEvent.click(screen.getByRole("button", { name: "Analizar OD" }));
    await screen.findByText("Resultado no concluyente");
    expect(screen.getByText(/No interprete la etiqueta mayor como riesgo del paciente/)).toBeInTheDocument();
  });

  it("guarda el análisis y reintenta sin repetir inferencia ni cambiar su identificador", async () => {
    const reportService = {
      load: vi.fn().mockResolvedValue({ analyses: [], approvedReport: null }),
      save: vi.fn().mockRejectedValueOnce(new Error("sensitive-details-hidden")).mockResolvedValue({}),
      approve: vi.fn(),
    } as unknown as RetinalReportService;
    render(<RetinalAnalysisPanel image={image} qualityStatus="ADECUADA" getImageUrl={getImageUrl} reportService={reportService} />);
    const button = screen.getByRole("button", { name: "Analizar OD" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("NO se guardó");
    expect(document.body).not.toHaveTextContent("sensitive-details-hidden");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar guardado" }));
    await screen.findByText(/Análisis guardado como borrador privado/);
    expect(infer).toHaveBeenCalledTimes(1);
    expect(reportService.save).toHaveBeenCalledTimes(2);
    const attempts = vi.mocked(reportService.save).mock.calls;
    expect(attempts[0]![0]).toBe(attempts[1]![0]);
  });

  it("no permite nuevos análisis cuando el informe está publicado", () => {
    render(<RetinalAnalysisPanel image={image} qualityStatus="ADECUADA" getImageUrl={getImageUrl} readOnly />);
    expect(screen.getByRole("button", { name: "Analizar OD" })).toBeDisabled();
  });
  it("espera una acción, obtiene una URL nueva y muestra las cinco puntuaciones relativas", async () => {
    render(<RetinalAnalysisPanel image={image} qualityStatus="ADECUADA" getImageUrl={getImageUrl} />);
    expect(infer).not.toHaveBeenCalled();
    expect(getImageUrl).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Analizar OD" }));
    await screen.findByText("Salida experimental del modelo");
    expect(getImageUrl).toHaveBeenCalledExactlyOnceWith(image);
    expect(infer).toHaveBeenCalledTimes(1);
    expect(inferenceRequest().image).toBe(image);
    expect(inferenceRequest().imageUrl).toBe("https://example.test/fresh-signed-url");
    expect(inferenceRequest().signal).toBeInstanceOf(AbortSignal);
    expect(inferenceRequest().onProgress).toBeTypeOf("function");
    const scores = screen.getByRole("list", { name: "Puntuaciones por categoría" });
    expect(within(scores).getAllByRole("listitem")).toHaveLength(5);
    prediction().scores.forEach(({ label, score }) => {
      expect(within(scores).getByText(label)).toBeInTheDocument();
      expect(within(scores).getByRole("meter", { name: `Puntuación relativa: ${label}` })).toHaveAttribute("value", String(score));
    });
    expect(within(scores).getByText("0,600")).toBeInTheDocument();
    expect(screen.getByText(/No representan probabilidad clínica ni exactitud diagnóstica/)).toBeInTheDocument();
    expect(screen.getByText(/no constituye un informe clínico ni se publica al paciente/)).toBeInTheDocument();
    expect(screen.getByText(/no se guarda en el expediente/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("completado");
  });

  it("bloquea envíos duplicados antes del siguiente render y anuncia progreso", async () => {
    const pending = deferred<RetinalPrediction>();
    infer.mockReturnValue(pending.promise);
    render(<RetinalAnalysisPanel image={image} qualityStatus="ADECUADA" getImageUrl={getImageUrl} />);
    const button = screen.getByRole("button", { name: "Analizar OD" });
    act(() => { button.click(); button.click(); });
    await waitFor(() => expect(infer).toHaveBeenCalledTimes(1));
    expect(getImageUrl).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    act(() => inferenceRequest().onProgress?.("Procesando imagen…"));
    expect(screen.getByRole("status")).toHaveTextContent("Procesando imagen…");
    await act(async () => { pending.resolve(prediction()); await pending.promise; });
    expect(button).toBeEnabled();
  });

  it.each(["URL", "inferencia"])("permite reintentar un error de %s sin exponer detalles sensibles", async (stage) => {
    const sensitiveError = new Error("https://private.example/patient/image?token=secret");
    if (stage === "URL") getImageUrl.mockRejectedValueOnce(sensitiveError);
    else infer.mockRejectedValueOnce(sensitiveError);
    render(<RetinalAnalysisPanel image={image} qualityStatus="ADECUADA" getImageUrl={getImageUrl} />);
    fireEvent.click(screen.getByRole("button", { name: "Analizar OD" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Verifique su conexión");
    expect(document.body).not.toHaveTextContent("private.example");
    expect(document.body).not.toHaveTextContent("token=secret");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar análisis OD" }));
    await screen.findByText("Salida experimental del modelo");
    expect(getImageUrl).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("deshabilita el análisis sin imagen o con calidad inadecuada", () => {
    const { rerender } = render(<RetinalAnalysisPanel image={null} qualityStatus="PENDIENTE" getImageUrl={getImageUrl} />);
    expect(screen.getByText(/Seleccione o cargue una imagen/)).toBeInTheDocument();
    const emptyButton = screen.getByRole("button");
    expect(emptyButton).toBeDisabled();
    fireEvent.click(emptyButton);
    rerender(<RetinalAnalysisPanel image={image} qualityStatus="INADECUADA" getImageUrl={getImageUrl} />);
    expect(screen.getByText(/Repita la captura/)).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
    fireEvent.click(screen.getByRole("button"));
    expect(getImageUrl).not.toHaveBeenCalled();
    expect(infer).not.toHaveBeenCalled();
  });

  it.each([
    "La captura tiene transparencia. Use una imagen retinal opaca para analizarla.",
    "La imagen supera 16 megapíxeles. Cargue una captura de menor resolución para este prototipo.",
    "No se pudo descargar la imagen autorizada. Vuelva a abrir el expediente e intente nuevamente.",
    "No se pudo cargar el modelo de IA. Compruebe la conexión y vuelva a intentarlo.",
  ])("muestra el error seguro del motor y permite reintentar: %s", async (message) => {
    infer.mockRejectedValueOnce(new RetinalInferenceError(message));
    render(<RetinalAnalysisPanel image={image} qualityStatus="ADECUADA" getImageUrl={getImageUrl} />);
    fireEvent.click(screen.getByRole("button", { name: "Analizar OD" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar análisis OD" }));
    await screen.findByText("Salida experimental del modelo");
    expect(getImageUrl).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("permite analizar OI con advertencia de calidad pendiente", async () => {
    const leftImage = { ...image, id: "image-oi", laterality: "OI" as const };
    infer.mockResolvedValue(prediction(leftImage));
    render(<RetinalAnalysisPanel image={leftImage} qualityStatus="PENDIENTE" getImageUrl={getImageUrl} />);
    expect(screen.getByText(/revisión de calidad está pendiente/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Analizar OI" }));
    await screen.findByText("Salida experimental del modelo");
    expect(getImageUrl).toHaveBeenCalledWith(leftImage);
  });

  it.each(["id", "screeningId", "organizationId", "storagePath", "updatedAt"] as const)("borra el resultado al cambiar %s", async (field) => {
    const { rerender } = render(<RetinalAnalysisPanel image={image} qualityStatus="ADECUADA" getImageUrl={getImageUrl} />);
    fireEvent.click(screen.getByRole("button"));
    await screen.findByText("Salida experimental del modelo");
    rerender(<RetinalAnalysisPanel image={{ ...image, [field]: `${image[field]}-changed` }} qualityStatus="ADECUADA" getImageUrl={getImageUrl} />);
    expect(screen.queryByText("Salida experimental del modelo")).not.toBeInTheDocument();
    expect(screen.getByRole("button")).toBeEnabled();
    expect(infer).toHaveBeenCalledTimes(1);
  });

  it.each(["resolve", "reject"] as const)("ignora progreso y %s de una imagen anterior mientras analiza la nueva", async (settlement) => {
    const old = deferred<RetinalPrediction>();
    const current = deferred<RetinalPrediction>();
    const leftImage = { ...image, id: "image-oi", laterality: "OI" as const };
    infer.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const { rerender } = render(<RetinalAnalysisPanel image={image} qualityStatus="ADECUADA" getImageUrl={getImageUrl} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(infer).toHaveBeenCalledTimes(1));
    const firstRequest = inferenceRequest();
    rerender(<RetinalAnalysisPanel image={leftImage} qualityStatus="ADECUADA" getImageUrl={getImageUrl} />);
    expect(firstRequest.signal?.aborted).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Analizar OI" }));
    await waitFor(() => expect(infer).toHaveBeenCalledTimes(2));
    await act(async () => {
      firstRequest.onProgress?.("Progreso anterior");
      if (settlement === "resolve") old.resolve(prediction());
      else old.reject(new Error("Error anterior"));
      await old.promise.catch(() => undefined);
    });
    expect(screen.queryByText("Salida experimental del modelo")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).not.toHaveTextContent("Progreso anterior");
    expect(screen.getByRole("button", { name: "Analizando OI…" })).toBeDisabled();
    await act(async () => { current.resolve(prediction(leftImage)); await current.promise; });
    expect(screen.getByText("Salida experimental del modelo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analizar OI" })).toBeEnabled();
  });

  it.each(["switch", "unmount"])("no inicia inferencia si una URL pendiente llega después de %s", async (action) => {
    const pendingUrl = deferred<string>();
    getImageUrl.mockReturnValue(pendingUrl.promise);
    const { rerender, unmount } = render(<RetinalAnalysisPanel image={image} qualityStatus="ADECUADA" getImageUrl={getImageUrl} />);
    fireEvent.click(screen.getByRole("button"));
    if (action === "unmount") unmount();
    else rerender(<RetinalAnalysisPanel image={null} qualityStatus="PENDIENTE" getImageUrl={getImageUrl} />);
    await act(async () => { pendingUrl.resolve("https://example.test/late-url"); await pendingUrl.promise; });
    expect(infer).not.toHaveBeenCalled();
    expect(screen.queryByText("Salida experimental del modelo")).not.toBeInTheDocument();
  });

  it("aborta al desmontar e ignora una inferencia que no respeta el aborto", async () => {
    const pending = deferred<RetinalPrediction>();
    infer.mockReturnValue(pending.promise);
    const { unmount, container } = render(<RetinalAnalysisPanel image={image} qualityStatus="ADECUADA" getImageUrl={getImageUrl} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(infer).toHaveBeenCalledTimes(1));
    const firstRequest = inferenceRequest();
    unmount();
    expect(firstRequest.signal?.aborted).toBe(true);
    await act(async () => {
      firstRequest.onProgress?.("Progreso tardío");
      pending.resolve(prediction());
      await pending.promise;
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("aborta y borra el progreso cuando la calidad pasa a inadecuada", async () => {
    const pending = deferred<RetinalPrediction>();
    infer.mockReturnValue(pending.promise);
    const { rerender } = render(<RetinalAnalysisPanel image={image} qualityStatus="ADECUADA" getImageUrl={getImageUrl} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(infer).toHaveBeenCalledTimes(1));
    rerender(<RetinalAnalysisPanel image={image} qualityStatus="INADECUADA" getImageUrl={getImageUrl} />);
    expect(inferenceRequest().signal?.aborted).toBe(true);
    await act(async () => { pending.resolve(prediction()); await pending.promise; });
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.queryByText("Salida experimental del modelo")).not.toBeInTheDocument();
  });

  it("retiene el resultado de la misma imagen y calidad aunque cambien objeto, URL o callback", async () => {
    const { rerender } = render(<RetinalAnalysisPanel image={image} qualityStatus="ADECUADA" getImageUrl={getImageUrl} />);
    fireEvent.click(screen.getByRole("button"));
    await screen.findByText("Salida experimental del modelo");
    const refreshedUrl = vi.fn<(selected: RetinalImage) => Promise<string>>().mockResolvedValue("https://example.test/renewed");
    rerender(<RetinalAnalysisPanel image={{ ...image, signedUrl: "https://example.test/renewed-preview" }} qualityStatus="ADECUADA" getImageUrl={refreshedUrl} />);
    expect(screen.getByText("Salida experimental del modelo")).toBeInTheDocument();
    expect(infer).toHaveBeenCalledTimes(1);
    expect(refreshedUrl).not.toHaveBeenCalled();
  });

  it.each(["INADECUADA", "PENDIENTE"] as const)("descarta el resultado completado al cambiar calidad a %s sin restaurarlo después", async (qualityStatus) => {
    const { rerender } = render(<RetinalAnalysisPanel image={image} qualityStatus="ADECUADA" getImageUrl={getImageUrl} />);
    fireEvent.click(screen.getByRole("button"));
    await screen.findByText("Salida experimental del modelo");
    rerender(<RetinalAnalysisPanel image={image} qualityStatus={qualityStatus} getImageUrl={getImageUrl} />);
    expect(screen.queryByText("Salida experimental del modelo")).not.toBeInTheDocument();
    if (qualityStatus === "INADECUADA") expect(screen.getByRole("button")).toBeDisabled();
    rerender(<RetinalAnalysisPanel image={image} qualityStatus="ADECUADA" getImageUrl={getImageUrl} />);
    expect(screen.queryByText("Salida experimental del modelo")).not.toBeInTheDocument();
    expect(infer).toHaveBeenCalledTimes(1);
  });

  it.each(["REEMPLAZADA", "ELIMINADA"] as const)("descarta el resultado y bloquea una imagen %s aunque no cambie updatedAt", async (status) => {
    const { rerender } = render(<RetinalAnalysisPanel image={image} qualityStatus="ADECUADA" getImageUrl={getImageUrl} />);
    fireEvent.click(screen.getByRole("button"));
    await screen.findByText("Salida experimental del modelo");
    rerender(<RetinalAnalysisPanel image={{ ...image, status }} qualityStatus="ADECUADA" getImageUrl={getImageUrl} />);
    expect(screen.queryByText("Salida experimental del modelo")).not.toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByText(/ya no está activa/)).toBeInTheDocument();
  });
});
