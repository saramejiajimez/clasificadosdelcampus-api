import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { handleRouteError } from '@/lib/errors';
import { listarFavoritosDesde } from '@/services/favoritos.service';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');

    const resultado = await listarFavoritosDesde(user.uid, since);
    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
