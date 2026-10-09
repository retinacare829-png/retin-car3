import { describe, expect, it } from "vitest";
import { describeRetinalUncertainty } from "./retinalModel";
import { retinalScoresSchema } from "./retinalReport";

describe("experimental retinal annex", () => {
  it("does not infer clinical certainty from a nearly uniform softmax", () => {
    expect(describeRetinalUncertainty([.21,.18,.22,.19,.20]).ambiguous).toBe(true);
    expect(describeRetinalUncertainty([.1,.1,.6,.1,.1]).title).toBe("Salida experimental del modelo");
  });
  it.each([[1], [.2,.2,.2,.2,NaN], [.2,.2,.2,.2,.3], [-1,1,1,0,0]])("rejects invalid scores %j", (...values) => {
    expect(retinalScoresSchema.safeParse(values).success).toBe(false);
  });
});
