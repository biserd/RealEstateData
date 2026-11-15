export class DatasetError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}
