import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { handleRouteError } from '@/lib/errors';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const user = await requireAuth(request);
    return NextResponse.json(
      {
        usuario: {
          id: user.uid,
          email: user.email,
          rol: user.rol,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
