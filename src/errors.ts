export class ApiError extends Error {
  constructor(
    public status: number,
    public errors: Record<string, string[]>,
  ) {
    super(JSON.stringify(errors));
  }
}
export const fail = (status: number, field: string, message: string): never => {
  throw new ApiError(status, { [field]: [message] });
};
