import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { adminOcultarAnuncioSchema } from '@/lib/schemas';
import { handleRouteError, parseJsonBody } from '@/lib/errors';
import { ocultarAnuncioAdmin } from '@/services/anuncios.service';

export const runtime = 'nodejs';

export interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { id } = await context.params;
    const raw = await parseJsonBody(request);
    adminOcultarAnuncioSchema.parse(raw);

    const oculto = await ocultarAnuncioAdmin(id);
    return NextResponse.json(oculto, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
