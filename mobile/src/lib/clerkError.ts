export function clerkErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  return (
    (err as { errors?: { message?: string }[] }).errors?.[0]?.message ??
    (err as Error).message ??
    fallback
  );
}
