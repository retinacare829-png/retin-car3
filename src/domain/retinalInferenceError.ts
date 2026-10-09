/** Only curated, user-safe messages may be constructed as this error type. */
export class RetinalInferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetinalInferenceError";
  }
}
