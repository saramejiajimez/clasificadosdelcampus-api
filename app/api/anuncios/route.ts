import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { crearAnuncioSchema } from '@/lib/schemas';
import { handleRouteError, parseJsonBody } from '@/lib/errors';
import {
  crearAnuncio,
  listarAnunciosActivos,
} from '@/services/anuncios.service';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const categoria = searchParams.get('categoria');
    const cursor = searchParams.get('cursor');

    const resultado = await listarAnunciosActivos(categoria, cursor);
    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireAuth(request);
    const raw = await parseJsonBody(request);
    const datos = crearAnuncioSchema.parse(raw);

    const creado = await crearAnuncio(user.uid, datos);
    return NextResponse.json(creado, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
