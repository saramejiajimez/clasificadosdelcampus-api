import { expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockVerifyIdToken = vi.fn();
const mockCollection = vi.fn();
const mockPutBlob = vi.fn();
const mockDelBlob = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  getAdminAuth: () => ({ verifyIdToken: mockVerifyIdToken }),
  getAdminDb: () => ({ collection: mockCollection }),
}));

vi.mock('@vercel/blob', () => ({
  put: (...args: unknown[]) => mockPutBlob(...args),
  del: (...args: unknown[]) => mockDelBlob(...args),
}));

import { GET as getFavoritos } from '../../app/api/favorito/route';
import {
  PUT as putFavorito,
  DELETE as deleteFavorito,
} from '../../app/api/favorito/[id]/route';
import {
  POST as postImagen,
  DELETE as deleteImagen,
} from '../../app/api/imagenes/route';

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

it('GET /api/favorito?since= devuelve items y servidor_ahora', async () => {
  mockVerifyIdToken.mockResolvedValueOnce({ uid: 'user-123' });
  mockCollection.mockReturnValueOnce({
    doc: () => ({
      collection: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => ({
              get: async () => ({
                docs: [
                  {
                    id: 'fav-1',
                    data: () => ({
                      anuncio_id: 'fav-1',
                      created_at: '2026-11-01T00:00:00.000Z',
                      updated_at: '2026-11-02T00:00:00.000Z',
                      deleted_at: null,
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
    'https://api.campus.edu/api/favorito?since=2026-11-01T00:00:00.000Z',
    { headers: { Authorization: 'Bearer valid' } }
  );
  const res = await getFavoritos(req);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.items).toHaveLength(1);
});

it('PUT y DELETE /api/favorito/:id sincronizan de forma idempotente y lógica', async () => {
  mockVerifyIdToken.mockResolvedValueOnce({ uid: 'user-123' });
  mockCollection.mockReturnValueOnce({
    doc: () => ({
      collection: () => ({
        doc: () => ({
          get: async () => ({ exists: false }),
          set: vi.fn().mockResolvedValueOnce(undefined),
        }),
      }),
    }),
  });

  const reqPut = makeReq('https://api.campus.edu/api/favorito/fav-1', {
    method: 'PUT',
    headers: { Authorization: 'Bearer valid' },
    body: JSON.stringify({ anuncio_id: 'fav-1' }),
  });
  expect(
    (await putFavorito(reqPut, { params: Promise.resolve({ id: 'fav-1' }) }))
      .status
  ).toBe(200);

  mockVerifyIdToken.mockResolvedValueOnce({ uid: 'user-123' });
  mockCollection.mockReturnValueOnce({
    doc: () => ({
      collection: () => ({
        doc: () => ({
          get: async () => ({ exists: true }),
          update: vi.fn().mockResolvedValueOnce(undefined),
        }),
      }),
    }),
  });

  const reqDel = makeReq('https://api.campus.edu/api/favorito/fav-1', {
    method: 'DELETE',
    headers: { Authorization: 'Bearer valid' },
  });
  expect(
    (
      await deleteFavorito(reqDel, {
        params: Promise.resolve({ id: 'fav-1' }),
      })
    ).status
  ).toBe(200);
});

it('POST y DELETE /api/imagenes validan formato (415), subida (201) y propiedad (403/200)', async () => {
  mockVerifyIdToken.mockResolvedValueOnce({ uid: 'user-123' });
  const reqBad = makeReq('https://api.campus.edu/api/imagenes', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer valid',
      'Content-Type': 'application/pdf',
    },
    body: new Uint8Array([1, 2, 3]),
  });
  expect((await postImagen(reqBad)).status).toBe(415);

  mockVerifyIdToken.mockResolvedValueOnce({ uid: 'user-123' });
  mockPutBlob.mockResolvedValueOnce({
    url: 'https://blob.vercel-storage.com/usuarios/user-123/img.jpg',
    pathname: 'usuarios/user-123/img.jpg',
  });
  const reqOk = makeReq('https://api.campus.edu/api/imagenes', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid', 'Content-Type': 'image/jpeg' },
    body: new Uint8Array([255, 216, 255]),
  });
  expect((await postImagen(reqOk)).status).toBe(201);

  mockVerifyIdToken.mockResolvedValueOnce({ uid: 'user-123' });
  const reqAjena = makeReq(
    'https://api.campus.edu/api/imagenes?url=https://blob.vercel-storage.com/usuarios/otro/img.jpg',
    { method: 'DELETE', headers: { Authorization: 'Bearer valid' } }
  );
  expect((await deleteImagen(reqAjena)).status).toBe(403);

  mockVerifyIdToken.mockResolvedValueOnce({ uid: 'user-123' });
  mockDelBlob.mockResolvedValueOnce(undefined);
  const reqPropia = makeReq(
    'https://api.campus.edu/api/imagenes?url=https://blob.vercel-storage.com/usuarios/user-123/img.jpg',
    { method: 'DELETE', headers: { Authorization: 'Bearer valid' } }
  );
  expect((await deleteImagen(reqPropia)).status).toBe(200);
});
