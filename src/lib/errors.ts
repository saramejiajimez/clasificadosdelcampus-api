import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export interface ErrorDetail {
  campo: string;
  mensaje: string;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly detalles?: ErrorDetail[];

  constructor(statusCode: number, message: string, detalles?: ErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.detalles = detalles;
  }
}

export function formatZodError(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    campo: issue.path.join('.') || 'cuerpo',
    mensaje: issue.message,
  }));
}

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    const payload: { error: string; detalles?: ErrorDetail[] } = {
      error: error.message,
    };
    if (error.detalles && error.detalles.length > 0) {
      payload.detalles = error.detalles;
    }
    return NextResponse.json(payload, { status: error.statusCode });
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Datos de entrada inválidos',
        detalles: formatZodError(error),
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ error: 'Error interno' }, { status: 500 });
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, 'El cuerpo de la petición debe ser JSON válido');
  }
}
