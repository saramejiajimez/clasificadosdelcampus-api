import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { reportarAnuncioSchema } from '@/lib/schemas';
import { handleRouteError, parseJsonBody } from '@/lib/errors';
import { reportarAnuncio } from '@/services/anuncios.service';

export const runtime = 'nodejs';

export interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const user = await requireAuth(request);
    const { id } = await context.params;
    const raw = await parseJsonBody(request);
    const { motivo } = reportarAnuncioSchema.parse(raw);

    const resultado = await reportarAnuncio(id, user.uid, motivo);
    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
