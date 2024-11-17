export class LockAcquisitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LockAcquisitionError';
  }
}
