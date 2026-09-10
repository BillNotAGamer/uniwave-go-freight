export async function runGuardedDatabaseOperation<T>(input: {
  authorize: () => unknown;
  operation: () => Promise<T> | T;
}): Promise<T> {
  input.authorize();
  return input.operation();
}
