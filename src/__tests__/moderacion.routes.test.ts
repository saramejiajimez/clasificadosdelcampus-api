import { expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockVerifyIdToken = vi.fn();
const mockCollection = vi.fn();
const mockRunTransaction = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  getAdminAuth: () => ({ verifyIdToken: mockVerifyIdToken }),
  getAdminDb: () => ({
    collection: mockCollection,
    runTransaction: mockRunTransaction,
  }),
}));

import { POST as postReportar } from '../../app/api/anuncios/[id]/reportar/route';
import { PATCH as patchAdminAnuncio } from '../../app/api/admin/anuncios/[id]/route';
import {
  PATCH as patchAnuncio,
  DELETE as deleteAnuncio,
} from '../../app/api/anuncios/[id]/route';
import { GET as getAnuncios } from '../../app/api/anuncios/route';
import { POST as postRegistro } from '../../app/api/auth/registro/route';
import {
  POST as postImagen,
  DELETE as deleteImagen,
} from '../../app/api/imagenes/route';
import {
  PUT as putFavorito,
  DELETE as deleteFavorito,
} from '../../app/api/favorito/[id]/route';
import { GET as getFavoritos } from '../../app/api/favorito/route';

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

it('POST /api/anuncios/:id/reportar crea reporte (201) y rechaza repetido (409)', async () => {
  mockVerifyIdToken.mockResolvedValueOnce({ uid: 'rep-1' });
  mockCollection.mockReturnValue({
    doc: () => ({ collection: () => ({ doc: () => ({}) }) }),
  });
  mockRunTransaction.mockImplementationOnce(async (cb) =>
    cb({
      get: vi
        .fn()
        .mockResolvedValueOnce({ exists: true, data: () => ({ reportes: 0 }) })
        .mockResolvedValueOnce({ exists: false }),
      create: vi.fn(),
      update: vi.fn(),
    })
  );
  const reqOk = makeReq('https://api.campus.edu/api/anuncios/a1/reportar', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid' },
    body: JSON.stringify({ motivo: 'Spam en el campus' }),
  });
  expect(
    (await postReportar(reqOk, { params: Promise.resolve({ id: 'a1' }) }))
      .status
  ).toBe(201);

  mockVerifyIdToken.mockResolvedValueOnce({ uid: 'rep-1' });
  mockRunTransaction.mockImplementationOnce(async (cb) =>
    cb({
      get: vi
        .fn()
        .mockResolvedValueOnce({ exists: true, data: () => ({ reportes: 1 }) })
        .mockResolvedValueOnce({ exists: true }),
      create: vi.fn(),
      update: vi.fn(),
    })
  );
  const reqDup = makeReq('https://api.campus.edu/api/anuncios/a1/reportar', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid' },
    body: JSON.stringify({ motivo: 'Spam repetido' }),
  });
  expect(
    (await postReportar(reqDup, { params: Promise.resolve({ id: 'a1' }) }))
      .status
  ).toBe(409);
});

it('CA-2: PATCH /api/admin/anuncios/:id exige rol admin (403 sin rol, 200 con admin)', async () => {
  mockVerifyIdToken.mockResolvedValueOnce({ uid: 'u1', rol: 'estudiante' });
  const reqNoAdmin = makeReq('https://api.campus.edu/api/admin/anuncios/a1', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer valid' },
    body: JSON.stringify({ estado: 'oculto' }),
  });
  expect(
    (
      await patchAdminAnuncio(reqNoAdmin, {
        params: Promise.resolve({ id: 'a1' }),
      })
    ).status
  ).toBe(403);

  mockVerifyIdToken.mockResolvedValueOnce({ uid: 'adm', rol: 'admin' });
  mockCollection.mockReturnValueOnce({
    doc: () => ({
      get: async () => ({
        exists: true,
        data: () => ({ id: 'a1', estado: 'activo', reportes: 3 }),
      }),
      update: vi.fn().mockResolvedValueOnce(undefined),
    }),
  });
  const reqAdmin = makeReq('https://api.campus.edu/api/admin/anuncios/a1', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer admin' },
    body: JSON.stringify({ estado: 'oculto' }),
  });
  expect(
    (
      await patchAdminAnuncio(reqAdmin, {
        params: Promise.resolve({ id: 'a1' }),
      })
    ).status
  ).toBe(200);
});

it('maneja errores 404 en anuncios y favoritos inexistentes', async () => {
  mockVerifyIdToken.mockResolvedValue({ uid: 'adm', rol: 'admin' });
  mockCollection.mockReturnValue({
    doc: () => ({
      get: async () => ({ exists: false }),
      collection: () => ({
        doc: () => ({ get: async () => ({ exists: false }) }),
      }),
    }),
  });

  const ctx = { params: Promise.resolve({ id: 'no-existe' }) };
  const h = { Authorization: 'Bearer valid' };

  const r1 = makeReq('https://api.campus.edu/api/anuncios/x', {
    method: 'PATCH',
    headers: h,
    body: JSON.stringify({ estado: 'vendido' }),
  });
  expect((await patchAnuncio(r1, ctx)).status).toBe(404);

  const r2 = makeReq('https://api.campus.edu/api/anuncios/x', {
    method: 'DELETE',
    headers: h,
  });
  expect((await deleteAnuncio(r2, ctx)).status).toBe(404);

  const r3 = makeReq('https://api.campus.edu/api/admin/anuncios/x', {
    method: 'PATCH',
    headers: h,
    body: JSON.stringify({ estado: 'oculto' }),
  });
  expect((await patchAdminAnuncio(r3, ctx)).status).toBe(404);

  const r4 = makeReq('https://api.campus.edu/api/favorito/x', {
    method: 'DELETE',
    headers: h,
  });
  expect((await deleteFavorito(r4, ctx)).status).toBe(404);
});

it('maneja JSON malformado (400), WEAK_PASSWORD (400) y errores de imagen (400/413)', async () => {
  const reqBadJson = makeReq('https://api.campus.edu/api/auth/registro', {
    method: 'POST',
    body: '{json-invalido',
  });
  expect((await postRegistro(reqBadJson)).status).toBe(400);

  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  fetchSpy.mockResolvedValueOnce(
    new Response(JSON.stringify({ error: { message: 'WEAK_PASSWORD' } }), {
      status: 400,
    })
  );
  const reqWeak = makeReq('https://api.campus.edu/api/auth/registro', {
    method: 'POST',
    body: JSON.stringify({
      email: 'weak@uni.edu.co',
      password: 'password123',
    }),
  });
  expect((await postRegistro(reqWeak)).status).toBe(400);
  fetchSpy.mockRestore();

  mockVerifyIdToken.mockResolvedValue({ uid: 'u1' });
  const reqEmptyImg = makeReq('https://api.campus.edu/api/imagenes', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid', 'Content-Type': 'image/png' },
    body: new Uint8Array(0),
  });
  expect((await postImagen(reqEmptyImg)).status).toBe(400);

  const reqHugeImg = makeReq('https://api.campus.edu/api/imagenes', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid', 'Content-Type': 'image/webp' },
    body: new Uint8Array(4 * 1024 * 1024 + 10),
  });
  expect((await postImagen(reqHugeImg)).status).toBe(413);

  const reqNoUrl = makeReq('https://api.campus.edu/api/imagenes', {
    method: 'DELETE',
    headers: { Authorization: 'Bearer valid' },
  });
  expect((await deleteImagen(reqNoUrl)).status).toBe(400);

  const reqBadUrl = makeReq(
    'https://api.campus.edu/api/imagenes?url=no-es-url',
    { method: 'DELETE', headers: { Authorization: 'Bearer valid' } }
  );
  expect((await deleteImagen(reqBadUrl)).status).toBe(400);
});

it('cubre listado sin filtros y error interno 500', async () => {
  mockVerifyIdToken.mockResolvedValue({ uid: 'u1' });
  mockCollection.mockReturnValueOnce({
    where: () => ({
      orderBy: () => ({
        limit: () => ({ get: async () => ({ docs: [] }) }),
      }),
    }),
  });
  const req = makeReq('https://api.campus.edu/api/anuncios', {
    headers: { Authorization: 'Bearer valid' },
  });
  expect((await getAnuncios(req)).status).toBe(200);

  mockCollection.mockImplementationOnce(() => {
    throw new Error('DB caida');
  });
  expect((await getAnuncios(req)).status).toBe(500);
});

it('cubre favoritos sin since y actualización de favorito existente', async () => {
  mockVerifyIdToken.mockResolvedValue({ uid: 'u1' });
  mockCollection.mockReturnValue({
    doc: () => ({
      collection: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => ({ get: async () => ({ docs: [] }) }),
          }),
        }),
        doc: () => ({
          get: async () => ({
            exists: true,
            data: () => ({ created_at: '2026-10-01T00:00:00.000Z' }),
          }),
          set: vi.fn().mockResolvedValueOnce(undefined),
        }),
      }),
    }),
  });
  const h = { Authorization: 'Bearer valid' };
  const reqFav = makeReq('https://api.campus.edu/api/favorito', { headers: h });
  expect((await getFavoritos(reqFav)).status).toBe(200);

  const reqPut = makeReq('https://api.campus.edu/api/favorito/fav-1', {
    method: 'PUT',
    headers: h,
    body: JSON.stringify({ anuncio_id: 'fav-1' }),
  });
  expect(
    (await putFavorito(reqPut, { params: Promise.resolve({ id: 'fav-1' }) }))
      .status
  ).toBe(200);
});
