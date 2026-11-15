import { getAdminDb } from '@/lib/firebase-admin';
import { ApiError } from '@/lib/errors';

export interface FavoritoSyncItem {
  id: string;
  anuncio_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export async function listarFavoritosDesde(
  uid: string,
  since?: string | null
): Promise<{ items: FavoritoSyncItem[]; servidor_ahora: string }> {
  const db = getAdminDb();
  const colRef = db.collection('usuarios').doc(uid).collection('favorito');

  const fechaBase =
    since && since.trim() !== '' ? since.trim() : '1970-01-01T00:00:00.000Z';

  const snapshot = await colRef
    .where('updated_at', '>', fechaBase)
    .orderBy('updated_at', 'asc')
    .limit(500)
    .get();

  const items: FavoritoSyncItem[] = snapshot.docs.map((doc) => {
    const raw = doc.data() as Omit<FavoritoSyncItem, 'id'>;
    return {
      id: doc.id,
      anuncio_id: raw.anuncio_id,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
      deleted_at: raw.deleted_at ?? null,
    };
  });

  return {
    items,
    servidor_ahora: new Date().toISOString(),
  };
}

export async function guardarFavorito(
  uid: string,
  id: string,
  anuncioId: string
): Promise<FavoritoSyncItem> {
  const db = getAdminDb();
  const docRef = db
    .collection('usuarios')
    .doc(uid)
    .collection('favorito')
    .doc(id);

  const existente = await docRef.get();
  const ahora = new Date().toISOString();
  const createdAt = existente.exists
    ? ((existente.data() as { created_at?: string } | undefined)?.created_at ??
      ahora)
    : ahora;

  const docData: FavoritoSyncItem = {
    id,
    anuncio_id: anuncioId,
    created_at: createdAt,
    updated_at: ahora,
    deleted_at: null,
  };

  await docRef.set(docData);
  return docData;
}

export async function borrarFavoritoLogico(
  uid: string,
  id: string
): Promise<{ ok: true }> {
  const db = getAdminDb();
  const docRef = db
    .collection('usuarios')
    .doc(uid)
    .collection('favorito')
    .doc(id);

  const snap = await docRef.get();
  if (!snap.exists) {
    throw new ApiError(404, 'Favorito no encontrado');
  }

  const ahora = new Date().toISOString();
  await docRef.update({
    updated_at: ahora,
    deleted_at: ahora,
  });

  return { ok: true };
}
