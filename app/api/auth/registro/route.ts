import { NextResponse } from 'next/server';
import { credencialesSchema } from '@/lib/schemas';
import { handleRouteError, parseJsonBody } from '@/lib/errors';
import { registrarConEmail } from '@/services/auth.service';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const raw = await parseJsonBody(request);
    const { email, password } = credencialesSchema.parse(raw);
    const resultado = await registrarConEmail(email, password);
    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
