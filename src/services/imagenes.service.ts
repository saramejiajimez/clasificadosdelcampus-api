import { randomUUID } from 'node:crypto';
import { put, del } from '@vercel/blob';
import { ApiError } from '@/lib/errors';

const MIME_TYPES_PERMITIDOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export async function subirImagenUsuario(
  uid: string,
  contentTypeHeader: string | null,
  bytes: ArrayBuffer
): Promise<{ url: string; pathname: string }> {
  const contentType = contentTypeHeader?.split(';')[0]?.trim().toLowerCase();
  const extension = contentType
    ? MIME_TYPES_PERMITIDOS[contentType]
    : undefined;

  if (!contentType || !extension) {
    throw new ApiError(
      415,
      'Tipo de archivo no permitido. Solo se aceptan JPEG, PNG o WebP'
    );
  }

  if (bytes.byteLength === 0) {
    throw new ApiError(400, 'El cuerpo de la imagen está vacío');
  }

  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new ApiError(413, 'La imagen supera el tamaño máximo de 4 MB');
  }

  const ruta = `usuarios/${uid}/${randomUUID()}.${extension}`;
  const resultado = await put(ruta, bytes, {
    access: 'public',
    addRandomSuffix: true,
    contentType,
  });

  return {
    url: resultado.url,
    pathname: resultado.pathname,
  };
}

export async function eliminarImagenUsuario(
  uid: string,
  targetUrl: string | null
): Promise<{ ok: true }> {
  if (!targetUrl || targetUrl.trim() === '') {
    throw new ApiError(400, 'El parámetro url es obligatorio');
  }

  let pathname = '';
  try {
    pathname = new URL(targetUrl).pathname;
  } catch {
    throw new ApiError(400, 'La URL proporcionada no es válida');
  }

  const prefijoPropio = `/usuarios/${uid}/`;
  if (!pathname.startsWith(prefijoPropio)) {
    throw new ApiError(403, 'Solo puedes eliminar tus propias imágenes');
  }

  await del(targetUrl);
  return { ok: true };
}
