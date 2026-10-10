import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common'

export interface ApiError { code: string; message: string; details: unknown[] }

const codes: Record<number, string> = {
  400: 'INVALID_REQUEST', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN',
  404: 'NOT_FOUND', 405: 'METHOD_NOT_ALLOWED', 409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE', 415: 'UNSUPPORTED_MEDIA_TYPE', 429: 'TOO_MANY_REQUESTS',
}

export function normalizeError(error: unknown): { status: number; body: ApiError } {
  const pgCode = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  if (pgCode === '23505' || pgCode === '23503') {
    return { status: 409, body: { code: 'CONFLICT', message: 'Los datos entran en conflicto con un registro existente o sus relaciones.', details: [] } }
  }
  if (['23514', '23502', '22001', '22003', '22P02'].includes(String(pgCode))) {
    return { status: 400, body: { code: 'INVALID_REQUEST', message: 'Los datos no cumplen las restricciones de la base.', details: [] } }
  }
  if (error instanceof HttpException && error.getStatus() < 500) {
    const status = error.getStatus()
    const response = error.getResponse()
    const payload = typeof response === 'string' ? { message: response } : response as { message?: string | string[]; details?: unknown[] }
    const messages = Array.isArray(payload.message) ? payload.message : undefined
    return {
      status,
      body: {
        code: codes[status] ?? 'HTTP_ERROR',
        message: messages ? messages.join(' ') : payload.message as string ?? error.message,
        details: Array.isArray(payload.details) ? payload.details : messages?.map((message) => ({ message })) ?? [],
      },
    }
  }
  return { status: 500, body: { code: 'INTERNAL_ERROR', message: 'No se pudo completar la solicitud.', details: [] } }
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const { status, body } = normalizeError(error)
    // La interfaz mínima evita añadir dependencias de tipos de Express.
    const response = host.switchToHttp().getResponse<{ status(code: number): { json(body: ApiError): void } }>()
    response.status(status).json(body)
  }
}
