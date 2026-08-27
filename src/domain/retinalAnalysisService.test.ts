import { describe, expect, it } from "vitest";
import { BetaRetinalAnalysisService, BETA_AI_ANALYSIS_STATUS } from "./retinalAnalysisService";

describe("BetaRetinalAnalysisService", () => {
  it("returns only NOT_AVAILABLE in the beta implementation", async () => {
    const service = new BetaRetinalAnalysisService();

    const response = await service.analyze({
      retinalImageId: "image-demo",
      organizationId: "clinic-demo",
      screeningId: "screening-demo",
    });

    expect(response.status).toBe(BETA_AI_ANALYSIS_STATUS);
    expect(response.message).toBe("Modulo de Inteligencia Artificial no disponible en esta version beta.");
  });
});
