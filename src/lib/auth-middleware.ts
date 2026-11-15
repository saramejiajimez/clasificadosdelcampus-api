import { getAdminAuth } from './firebase-admin';
import { ApiError } from './errors';

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  rol: string | null;
}

export async function requireAuth(
  request: Request
): Promise<AuthenticatedUser> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Token de autenticación requerido');
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new ApiError(401, 'Token de autenticación vacío');
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const rolClaim = typeof decoded['rol'] === 'string' ? decoded['rol'] : null;

    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      rol: rolClaim,
    };
  } catch {
    throw new ApiError(401, 'Token inválido o expirado');
  }
}

export async function requireAdmin(
  request: Request
): Promise<AuthenticatedUser> {
  const user = await requireAuth(request);
  if (user.rol !== 'admin') {
    throw new ApiError(403, 'Se requiere rol de administrador');
  }
  return user;
}
