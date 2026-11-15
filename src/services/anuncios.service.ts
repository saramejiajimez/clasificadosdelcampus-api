import { randomUUID } from 'node:crypto';
import { del } from '@vercel/blob';
import { getAdminDb } from '@/lib/firebase-admin';
import { ApiError } from '@/lib/errors';

export interface AnuncioDocument {
  id: string;
  owner_uid: string;
  titulo: string;
  descripcion: string;
  precio_centavos: number;
  categoria: string;
  fotos: string[];
  whatsapp: string;
  lat: number | null;
  lng: number | null;
  estado: 'activo' | 'vendido' | 'oculto';
  reportes: number;
  creado_en: string;
}

export interface CrearAnuncioInput {
  id?: string;
  titulo: string;
  descripcion: string;
  precio_centavos: number;
  categoria: string;
  fotos: string[];
  whatsapp: string;
  lat: number | null;
  lng: number | null;
}

export function verificarFotosDeUsuario(fotos: string[], uid: string): void {
  const prefijoEsperado = `/usuarios/${uid}/`;
  for (const fotoUrl of fotos) {
    let pathname = '';
    try {
      pathname = new URL(fotoUrl).pathname;
    } catch {
      throw new ApiError(400, 'URL de foto inválida');
    }
    if (!pathname.startsWith(prefijoEsperado)) {
      throw new ApiError(
        403,
        'Todas las fotos deben pertenecer al usuario autenticado'
      );
    }
  }
}

export async function listarAnunciosActivos(
  categoria?: string | null,
  cursor?: string | null
): Promise<{ items: AnuncioDocument[]; nextCursor: string | null }> {
  const db = getAdminDb();
  const baseQuery = db.collection('anuncios').where('estado', '==', 'activo');

  const filteredQuery =
    categoria && categoria.trim() !== ''
      ? baseQuery.where('categoria', '==', categoria.trim())
      : baseQuery;

  const orderedQuery = filteredQuery.orderBy('creado_en', 'desc');
  const paginatedQuery =
    cursor && cursor.trim() !== ''
      ? orderedQuery.startAfter(cursor.trim())
      : orderedQuery;

  const snapshot = await paginatedQuery.limit(20).get();
  const items: AnuncioDocument[] = snapshot.docs.map((doc) => ({
    ...(doc.data() as Omit<AnuncioDocument, 'id'>),
    id: doc.id,
  }));

  const ultimo = items[items.length - 1];
  const nextCursor = items.length === 20 && ultimo ? ultimo.creado_en : null;

  return { items, nextCursor };
}

export async function crearAnuncio(
  uid: string,
  input: CrearAnuncioInput
): Promise<AnuncioDocument> {
  verificarFotosDeUsuario(input.fotos, uid);

  const db = getAdminDb();
  const anunciosRef = db.collection('anuncios');

  const countSnap = await anunciosRef
    .where('owner_uid', '==', uid)
    .where('estado', '==', 'activo')
    .count()
    .get();

  const totalActivos = countSnap.data().count;
  if (totalActivos >= 5) {
    throw new ApiError(
      409,
      'Ya tienes el máximo permitido de 5 anuncios activos'
    );
  }

  const id = input.id ?? randomUUID();
  const ahora = new Date().toISOString();

  const nuevoAnuncio: AnuncioDocument = {
    id,
    owner_uid: uid,
    titulo: input.titulo,
    descripcion: input.descripcion,
    precio_centavos: input.precio_centavos,
    categoria: input.categoria,
    fotos: input.fotos,
    whatsapp: input.whatsapp,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    estado: 'activo',
    reportes: 0,
    creado_en: ahora,
  };

  await anunciosRef.doc(id).set(nuevoAnuncio);
  return nuevoAnuncio;
}

export async function marcarAnuncioVendido(
  id: string,
  uid: string
): Promise<AnuncioDocument> {
  const db = getAdminDb();
  const docRef = db.collection('anuncios').doc(id);
  const snap = await docRef.get();

  if (!snap.exists) {
    throw new ApiError(404, 'Anuncio no encontrado');
  }

  const data = snap.data() as AnuncioDocument;
  if (data.owner_uid !== uid) {
    throw new ApiError(403, 'Solo el dueño puede modificar este anuncio');
  }

  await docRef.update({ estado: 'vendido' });
  return { ...data, id, estado: 'vendido' };
}

export async function eliminarAnuncio(id: string, uid: string): Promise<void> {
  const db = getAdminDb();
  const docRef = db.collection('anuncios').doc(id);
  const snap = await docRef.get();

  if (!snap.exists) {
    throw new ApiError(404, 'Anuncio no encontrado');
  }

  const data = snap.data() as AnuncioDocument;
  if (data.owner_uid !== uid) {
    throw new ApiError(403, 'Solo el dueño puede eliminar este anuncio');
  }

  if (Array.isArray(data.fotos) && data.fotos.length > 0) {
    await Promise.all(data.fotos.map((url) => del(url)));
  }

  await docRef.delete();
}

export async function reportarAnuncio(
  anuncioId: string,
  uid: string,
  motivo: string
): Promise<{ ok: true; reportes: number }> {
  const db = getAdminDb();
  const anuncioRef = db.collection('anuncios').doc(anuncioId);
  const reporteRef = anuncioRef.collection('reportes').doc(uid);

  const nuevoTotal = await db.runTransaction(async (tx) => {
    const anuncioSnap = await tx.get(anuncioRef);
    const reporteSnap = await tx.get(reporteRef);

    if (!anuncioSnap.exists) {
      throw new ApiError(404, 'Anuncio no encontrado');
    }

    if (reporteSnap.exists) {
      throw new ApiError(409, 'Ya has reportado este anuncio anteriormente');
    }

    const actual =
      (anuncioSnap.data() as { reportes?: number } | undefined)?.reportes ?? 0;
    const total = actual + 1;

    tx.create(reporteRef, {
      motivo,
      creado_en: new Date().toISOString(),
    });
    tx.update(anuncioRef, { reportes: total });

    return total;
  });

  return { ok: true, reportes: nuevoTotal };
}

export async function ocultarAnuncioAdmin(
  anuncioId: string
): Promise<AnuncioDocument> {
  const db = getAdminDb();
  const docRef = db.collection('anuncios').doc(anuncioId);
  const snap = await docRef.get();

  if (!snap.exists) {
    throw new ApiError(404, 'Anuncio no encontrado');
  }

  const data = snap.data() as AnuncioDocument;
  await docRef.update({ estado: 'oculto' });

  return { ...data, id: anuncioId, estado: 'oculto' };
}
