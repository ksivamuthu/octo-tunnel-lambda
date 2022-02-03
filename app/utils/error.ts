export class TError extends Error {
  constructor(public message: string, public code: number = 500) {
    super(message);
    this.name = "WebHookServiceError";
  }
}
