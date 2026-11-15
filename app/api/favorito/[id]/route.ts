import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { favoritoPutSchema } from '@/lib/schemas';
import { handleRouteError, parseJsonBody } from '@/lib/errors';
import {
  borrarFavoritoLogico,
  guardarFavorito,
} from '@/services/favoritos.service';

export const runtime = 'nodejs';

export interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const user = await requireAuth(request);
    const { id } = await context.params;
    const raw = await parseJsonBody(request);
    const { anuncio_id } = favoritoPutSchema.parse(raw);

    const guardado = await guardarFavorito(user.uid, id, anuncio_id);
    return NextResponse.json(guardado, { status: 200 });
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
    const resultado = await borrarFavoritoLogico(user.uid, id);
    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
