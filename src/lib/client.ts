import type { Snapshot } from '../../shared/model.ts'
import type { Command } from '../../shared/commands.ts'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public latest?: Snapshot,
  ) {
    super(message)
  }
}
async function request(options?: RequestInit): Promise<Snapshot> {
  let response: Response
  try {
    response = await fetch('/api/state', {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
    })
  } catch {
    throw new ApiError('Connection lost. Keep this page open and retry when connected.', 0)
  }
  if (!response.headers.get('Content-Type')?.includes('application/json')) {
    throw new ApiError('Your sign-in has expired. Reload to sign in again.', 401)
  }
  const body = await response.json()
  if (!response.ok)
    throw new ApiError(
      body.error ?? 'Could not save. Please retry.',
      response.status,
      body.state ? body : undefined,
    )
  return body as Snapshot
}
export const getSnapshot = () => request()
export const saveCommand = (revision: number, command: Command) =>
  request({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision, command }),
  })
