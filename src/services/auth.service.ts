import { ApiError } from '@/lib/errors';

export interface AuthResponsePayload {
  token: string;
  refreshToken: string;
  expiraEnSeg: number;
  usuario: {
    id: string;
    email: string;
  };
}

export interface RefreshResponsePayload {
  token: string;
  refreshToken: string;
  expiraEnSeg: number;
}

interface FirebaseIdentityResponse {
  idToken?: string;
  refreshToken?: string;
  expiresIn?: string;
  localId?: string;
  email?: string;
  error?: {
    message?: string;
  };
}

interface FirebaseSecureTokenResponse {
  id_token?: string;
  refresh_token?: string;
  expires_in?: string;
  error?: {
    message?: string;
  };
}

function getWebApiKey(): string {
  const key = process.env.FIREBASE_WEB_API_KEY;
  if (!key) {
    throw new Error('FIREBASE_WEB_API_KEY no configurada');
  }
  return key;
}

function mapFirebaseAuthError(code: string): ApiError {
  if (code.includes('EMAIL_EXISTS')) {
    return new ApiError(409, 'El correo electrónico ya está registrado');
  }
  if (code.includes('WEAK_PASSWORD')) {
    return new ApiError(400, 'La contraseña es demasiado débil');
  }
  if (code.includes('TOO_MANY_ATTEMPTS')) {
    return new ApiError(429, 'Demasiados intentos fallidos. Intente más tarde');
  }
  if (
    code.includes('INVALID_LOGIN_CREDENTIALS') ||
    code.includes('EMAIL_NOT_FOUND') ||
    code.includes('INVALID_PASSWORD') ||
    code.includes('USER_DISABLED')
  ) {
    return new ApiError(401, 'Credenciales inválidas');
  }
  return new ApiError(401, 'Credenciales inválidas');
}

export async function registrarConEmail(
  email: string,
  password: string
): Promise<AuthResponsePayload> {
  const apiKey = getWebApiKey();
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });

  const data = (await response.json()) as FirebaseIdentityResponse;
  if (!response.ok || !data.idToken || !data.refreshToken || !data.localId) {
    throw mapFirebaseAuthError(data.error?.message ?? 'AUTH_ERROR');
  }

  return {
    token: data.idToken,
    refreshToken: data.refreshToken,
    expiraEnSeg: Number(data.expiresIn ?? '3600'),
    usuario: {
      id: data.localId,
      email: data.email ?? email,
    },
  };
}

export async function loginConEmail(
  email: string,
  password: string
): Promise<AuthResponsePayload> {
  const apiKey = getWebApiKey();
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });

  const data = (await response.json()) as FirebaseIdentityResponse;
  if (!response.ok || !data.idToken || !data.refreshToken || !data.localId) {
    throw mapFirebaseAuthError(data.error?.message ?? 'AUTH_ERROR');
  }

  return {
    token: data.idToken,
    refreshToken: data.refreshToken,
    expiraEnSeg: Number(data.expiresIn ?? '3600'),
    usuario: {
      id: data.localId,
      email: data.email ?? email,
    },
  };
}

export async function renovarToken(
  refreshToken: string
): Promise<RefreshResponsePayload> {
  const apiKey = getWebApiKey();
  const url = `https://securetoken.googleapis.com/v1/token?key=${apiKey}`;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = (await response.json()) as FirebaseSecureTokenResponse;
  if (!response.ok || !data.id_token || !data.refresh_token) {
    throw new ApiError(401, 'No se pudo renovar la sesión');
  }

  return {
    token: data.id_token,
    refreshToken: data.refresh_token,
    expiraEnSeg: Number(data.expires_in ?? '3600'),
  };
}
