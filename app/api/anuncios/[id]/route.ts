import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { actualizarEstadoAnuncioSchema } from '@/lib/schemas';
import { handleRouteError, parseJsonBody } from '@/lib/errors';
import {
  eliminarAnuncio,
  marcarAnuncioVendido,
} from '@/services/anuncios.service';

export const runtime = 'nodejs';

export interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const user = await requireAuth(request);
    const { id } = await context.params;
    const raw = await parseJsonBody(request);
    actualizarEstadoAnuncioSchema.parse(raw);

    const actualizado = await marcarAnuncioVendido(id, user.uid);
    return NextResponse.json(actualizado, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const user = await requireAuth(request);
    const { id } = await context.params;
    await eliminarAnuncio(id, user.uid);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
