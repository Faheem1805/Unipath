export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-UniPath-Client': 'web', ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'The server is unavailable.' }));
    const details = Array.isArray(body.details)
      ? body.details
          .map((d: unknown) =>
            typeof d === 'string'
              ? d
              : typeof d === 'object' && d && 'message' in d
                ? `${'path' in d && d.path ? `${String(d.path)}: ` : ''}${String(d.message)}`
                : '',
          )
          .filter(Boolean)
          .join(' · ')
      : '';
    throw new ApiError(
      `${body.error ?? 'Request failed.'}${details ? ` ${details}` : ''}`,
      response.status,
      body.details,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const send = (method: string, body?: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body ?? {}),
});
export function download(filename: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
