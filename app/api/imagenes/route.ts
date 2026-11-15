import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { handleRouteError } from '@/lib/errors';
import {
  eliminarImagenUsuario,
  subirImagenUsuario,
} from '@/services/imagenes.service';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireAuth(request);
    const contentType = request.headers.get('content-type');
    const bytes = await request.arrayBuffer();

    const subida = await subirImagenUsuario(user.uid, contentType, bytes);
    return NextResponse.json(subida, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    const resultado = await eliminarImagenUsuario(user.uid, url);
    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
