import { NextResponse } from 'next/server';
import { refreshSchema } from '@/lib/schemas';
import { handleRouteError, parseJsonBody } from '@/lib/errors';
import { renovarToken } from '@/services/auth.service';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const raw = await parseJsonBody(request);
    const { refreshToken } = refreshSchema.parse(raw);
    const resultado = await renovarToken(refreshToken);
    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
