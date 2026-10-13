import { AppError } from "@/lib/repo";

export function ok<T>(data: T, init?: ResponseInit) {
  return Response.json({ ok: true, data }, init);
}

export function fail(error: unknown) {
  if (error instanceof AppError) {
    return Response.json({ ok: false, error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected server error";
  console.error("[api]", message);
  return Response.json({ ok: false, error: message }, { status: 500 });
}

export async function withHandler<T>(fn: () => Promise<T>): Promise<Response> {
  try {
    const data = await fn();
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

export function parseId(value: string | undefined, label = "id"): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(`Invalid ${label}.`, 400);
  }
  return id;
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new AppError("Request body must be valid JSON.", 400);
  }
}
