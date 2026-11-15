import { expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockVerifyIdToken = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  getAdminAuth: () => ({ verifyIdToken: mockVerifyIdToken }),
  getAdminDb: () => ({}),
}));

import { GET as getHealth } from '../../app/api/health/route';
import { GET as getYo } from '../../app/api/auth/yo/route';
import { POST as postRegistro } from '../../app/api/auth/registro/route';
import { POST as postLogin } from '../../app/api/auth/login/route';
import { POST as postRefresh } from '../../app/api/auth/refresh/route';

function makeReq(
  url: string,
  options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit | null;
  }
): NextRequest {
  return new NextRequest(new URL(url, 'https://api.campus.edu'), options);
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FIREBASE_WEB_API_KEY = 'test-web-api-key';
});

it('GET /api/health responde 200 ok', async () => {
  const res = await getHealth();
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.ok).toBe(true);
});

it('GET /api/auth/yo rechaza con 401 sin token o con token inválido', async () => {
  const reqNoToken = makeReq('https://api.campus.edu/api/auth/yo');
  const resNoToken = await getYo(reqNoToken);
  expect(resNoToken.status).toBe(401);

  mockVerifyIdToken.mockRejectedValueOnce(new Error('Invalid'));
  const reqBad = makeReq('https://api.campus.edu/api/auth/yo', {
    headers: { Authorization: 'Bearer bad' },
  });
  const resBad = await getYo(reqBad);
  expect(resBad.status).toBe(401);
});

it('GET /api/auth/yo devuelve el usuario autenticado con token válido', async () => {
  mockVerifyIdToken.mockResolvedValueOnce({
    uid: 'user-123',
    email: 'est@uni.edu.co',
    rol: 'estudiante',
  });
  const req = makeReq('https://api.campus.edu/api/auth/yo', {
    headers: { Authorization: 'Bearer valido' },
  });
  const res = await getYo(req);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.usuario.id).toBe('user-123');
});

it('POST /api/auth/registro registra (201) y rechaza duplicado (409)', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  fetchSpy.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        idToken: 'id-tok',
        refreshToken: 'ref-tok',
        expiresIn: '3600',
        localId: 'uid-1',
        email: 'nuevo@uni.edu.co',
      }),
      { status: 200 }
    )
  );

  const reqOk = makeReq('https://api.campus.edu/api/auth/registro', {
    method: 'POST',
    body: JSON.stringify({
      email: 'nuevo@uni.edu.co',
      password: 'password123',
    }),
  });
  const resOk = await postRegistro(reqOk);
  expect(resOk.status).toBe(201);

  fetchSpy.mockResolvedValueOnce(
    new Response(JSON.stringify({ error: { message: 'EMAIL_EXISTS' } }), {
      status: 400,
    })
  );
  const reqDup = makeReq('https://api.campus.edu/api/auth/registro', {
    method: 'POST',
    body: JSON.stringify({
      email: 'nuevo@uni.edu.co',
      password: 'password123',
    }),
  });
  const resDup = await postRegistro(reqDup);
  expect(resDup.status).toBe(409);
  fetchSpy.mockRestore();
});

it('POST /api/auth/login maneja 200, 401 y 429', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  fetchSpy.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        idToken: 'id-tok',
        refreshToken: 'ref-tok',
        expiresIn: '3600',
        localId: 'uid-1',
        email: 'ok@uni.edu.co',
      }),
      { status: 200 }
    )
  );
  const reqOk = makeReq('https://api.campus.edu/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'ok@uni.edu.co', password: 'password123' }),
  });
  expect((await postLogin(reqOk)).status).toBe(200);

  fetchSpy.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }),
      { status: 400 }
    )
  );
  const reqBad = makeReq('https://api.campus.edu/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'no@uni.edu.co', password: 'password123' }),
  });
  expect((await postLogin(reqBad)).status).toBe(401);

  fetchSpy.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ error: { message: 'TOO_MANY_ATTEMPTS_TRY_LATER' } }),
      { status: 400 }
    )
  );
  const reqRate = makeReq('https://api.campus.edu/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'no@uni.edu.co', password: 'password123' }),
  });
  expect((await postLogin(reqRate)).status).toBe(429);
  fetchSpy.mockRestore();
});

it('POST /api/auth/refresh renueva token (200) y falla con 401 si es inválido', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  fetchSpy.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        id_token: 'new-id',
        refresh_token: 'new-ref',
        expires_in: '3600',
      }),
      { status: 200 }
    )
  );
  const req = makeReq('https://api.campus.edu/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: 'old-refresh' }),
  });
  expect((await postRefresh(req)).status).toBe(200);

  fetchSpy.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ error: { message: 'INVALID_REFRESH_TOKEN' } }),
      {
        status: 400,
      }
    )
  );
  const reqFail = makeReq('https://api.campus.edu/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: 'bad-refresh' }),
  });
  expect((await postRefresh(reqFail)).status).toBe(401);
  fetchSpy.mockRestore();
});
