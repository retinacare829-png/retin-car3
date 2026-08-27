export const BETA_AI_ANALYSIS_STATUS = "NOT_AVAILABLE";

export type RetinalAnalysisStatus =
  | typeof BETA_AI_ANALYSIS_STATUS
  | "COMPLETED"
  | "IMAGE_NOT_INTERPRETABLE"
  | "FAILED"
  | "REVIEW_REQUIRED";

export interface RetinalAnalysisRequest {
  retinalImageId: string;
  organizationId: string;
  screeningId: string;
}

export interface RetinalAnalysisResponse {
  status: RetinalAnalysisStatus;
  message: string;
  generatedAt: string;
}

export interface RetinalAnalysisService {
  analyze(request: RetinalAnalysisRequest): Promise<RetinalAnalysisResponse>;
}

export class BetaRetinalAnalysisService implements RetinalAnalysisService {
  analyze(request: RetinalAnalysisRequest): Promise<RetinalAnalysisResponse> {
    void request;

    return Promise.resolve({
      status: BETA_AI_ANALYSIS_STATUS,
      message: "Modulo de Inteligencia Artificial no disponible en esta version beta.",
      generatedAt: new Date().toISOString(),
    });
  }
}
