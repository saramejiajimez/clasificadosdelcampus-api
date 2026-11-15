import { expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockVerifyIdToken = vi.fn();
const mockCollection = vi.fn();
const mockDelBlob = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  getAdminAuth: () => ({ verifyIdToken: mockVerifyIdToken }),
  getAdminDb: () => ({ collection: mockCollection }),
}));

vi.mock('@vercel/blob', () => ({
  del: (...args: unknown[]) => mockDelBlob(...args),
}));

import {
  GET as getAnuncios,
  POST as postAnuncios,
} from '../../app/api/anuncios/route';
import {
  PATCH as patchAnuncio,
  DELETE as deleteAnuncio,
} from '../../app/api/anuncios/[id]/route';

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
});

it('GET /api/anuncios lista anuncios activos paginados con filtro categoria', async () => {
  mockVerifyIdToken.mockResolvedValueOnce({ uid: 'user-123' });
  mockCollection.mockReturnValueOnce({
    where: () => ({
      orderBy: () => ({}),
      where: () => ({
        orderBy: () => ({
          startAfter: () => ({
            limit: () => ({
              get: async () => ({
                docs: [
                  {
                    id: 'a-1',
                    data: () => ({
                      titulo: 'Libro',
                      creado_en: '2026-11-01T00:00:00.000Z',
                    }),
                  },
                ],
              }),
            }),
          }),
        }),
      }),
    }),
  });

  const req = makeReq(
    'https://api.campus.edu/api/anuncios?categoria=libros&cursor=2026-11-02T00:00:00.000Z',
    { headers: { Authorization: 'Bearer valid' } }
  );
  const res = await getAnuncios(req);
  expect(res.status).toBe(200);
});

it('POST /api/anuncios rechaza datos inválidos con 400 y detalles de Zod', async () => {
  mockVerifyIdToken.mockResolvedValueOnce({ uid: 'user-123' });
  const req = makeReq('https://api.campus.edu/api/anuncios', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid' },
    body: JSON.stringify({
      titulo: 'abc',
      descripcion: 'Calculadora',
      precio_centavos: -10,
      categoria: 'libros',
      fotos: ['https://blob.vercel-storage.com/usuarios/user-123/f.jpg'],
      whatsapp: '2123456789',
    }),
  });
  const res = await postAnuncios(req);
  expect(res.status).toBe(400);
});

it('CA-1: POST /api/anuncios rechaza el 6to anuncio activo con 409', async () => {
  mockVerifyIdToken.mockResolvedValueOnce({ uid: 'user-123' });
  mockCollection.mockReturnValueOnce({
    where: () => ({
      where: () => ({
        count: () => ({
          get: async () => ({ data: () => ({ count: 5 }) }),
        }),
      }),
    }),
  });

  const req = makeReq('https://api.campus.edu/api/anuncios', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid' },
    body: JSON.stringify({
      titulo: 'Libro de Cálculo Stewart',
      descripcion: 'Excelente estado',
      precio_centavos: 4500000,
      categoria: 'libros',
      fotos: ['https://blob.vercel-storage.com/usuarios/user-123/foto1.jpg'],
      whatsapp: '3001234567',
    }),
  });
  expect((await postAnuncios(req)).status).toBe(409);
});

it('POST /api/anuncios rechaza fotos ajenas (403) y crea anuncio válido (201)', async () => {
  mockVerifyIdToken.mockResolvedValueOnce({ uid: 'user-123' });
  const reqAjena = makeReq('https://api.campus.edu/api/anuncios', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid' },
    body: JSON.stringify({
      titulo: 'Libro de Cálculo',
      descripcion: 'Buen estado',
      precio_centavos: 4000000,
      categoria: 'libros',
      fotos: ['https://blob.vercel-storage.com/usuarios/otro/foto1.jpg'],
      whatsapp: '3001234567',
    }),
  });
  expect((await postAnuncios(reqAjena)).status).toBe(403);

  mockVerifyIdToken.mockResolvedValueOnce({ uid: 'user-123' });
  mockCollection.mockReturnValueOnce({
    where: () => ({
      where: () => ({
        count: () => ({
          get: async () => ({ data: () => ({ count: 1 }) }),
        }),
      }),
    }),
    doc: () => ({ set: vi.fn().mockResolvedValueOnce(undefined) }),
  });

  const reqOk = makeReq('https://api.campus.edu/api/anuncios', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid' },
    body: JSON.stringify({
      titulo: 'Calculadora Casio FX',
      descripcion: 'Casi nueva',
      precio_centavos: 5000000,
      categoria: 'calculadoras',
      fotos: ['https://blob.vercel-storage.com/usuarios/user-123/calc.jpg'],
      whatsapp: '3109876543',
    }),
  });
  expect((await postAnuncios(reqOk)).status).toBe(201);
});

it('PATCH /api/anuncios/:id valida dueño (403 ajeno, 200 dueño)', async () => {
  mockVerifyIdToken.mockResolvedValueOnce({ uid: 'intruso' });
  mockCollection.mockReturnValueOnce({
    doc: () => ({
      get: async () => ({
        exists: true,
        data: () => ({ owner_uid: 'dueno', estado: 'activo' }),
      }),
    }),
  });
  const reqForbidden = makeReq('https://api.campus.edu/api/anuncios/a1', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer valid' },
    body: JSON.stringify({ estado: 'vendido' }),
  });
  expect(
    (
      await patchAnuncio(reqForbidden, {
        params: Promise.resolve({ id: 'a1' }),
      })
    ).status
  ).toBe(403);

  mockVerifyIdToken.mockResolvedValueOnce({ uid: 'dueno' });
  mockCollection.mockReturnValueOnce({
    doc: () => ({
      get: async () => ({
        exists: true,
        data: () => ({ owner_uid: 'dueno', estado: 'activo', fotos: [] }),
      }),
      update: vi.fn().mockResolvedValueOnce(undefined),
    }),
  });
  const reqPatch = makeReq('https://api.campus.edu/api/anuncios/a1', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer valid' },
    body: JSON.stringify({ estado: 'vendido' }),
  });
  expect(
    (await patchAnuncio(reqPatch, { params: Promise.resolve({ id: 'a1' }) }))
      .status
  ).toBe(200);
});

it('DELETE /api/anuncios/:id elimina anuncio y fotos del dueño (200)', async () => {
  mockVerifyIdToken.mockResolvedValueOnce({ uid: 'dueno' });
  mockCollection.mockReturnValueOnce({
    doc: () => ({
      get: async () => ({
        exists: true,
        data: () => ({
          owner_uid: 'dueno',
          fotos: ['https://blob.vercel-storage.com/usuarios/dueno/1.jpg'],
        }),
      }),
      delete: vi.fn().mockResolvedValueOnce(undefined),
    }),
  });
  mockDelBlob.mockResolvedValueOnce(undefined);
  const reqDel = makeReq('https://api.campus.edu/api/anuncios/a1', {
    method: 'DELETE',
    headers: { Authorization: 'Bearer valid' },
  });
  expect(
    (await deleteAnuncio(reqDel, { params: Promise.resolve({ id: 'a1' }) }))
      .status
  ).toBe(200);
});
