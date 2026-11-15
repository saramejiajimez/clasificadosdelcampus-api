import { z } from 'zod';

export const credencialesSchema = z
  .object({
    email: z.string().trim().email('Correo electrónico inválido'),
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .max(128, 'La contraseña es demasiado larga'),
  })
  .strict();

export const refreshSchema = z
  .object({
    refreshToken: z.string().trim().min(1, 'El refreshToken es obligatorio'),
  })
  .strict();

export const telefonoColombianoRegex = /^3\d{9}$/;

export const crearAnuncioSchema = z
  .object({
    id: z.string().uuid('El id debe ser un UUID válido').optional(),
    titulo: z
      .string()
      .trim()
      .min(5, 'El título debe tener entre 5 y 80 caracteres')
      .max(80, 'El título debe tener entre 5 y 80 caracteres'),
    descripcion: z
      .string()
      .trim()
      .min(1, 'La descripción es obligatoria')
      .max(1000, 'La descripción no puede superar 1000 caracteres'),
    precio_centavos: z
      .number()
      .int('El precio debe ser un entero en centavos')
      .min(0, 'El precio debe ser mayor o igual a 0'),
    categoria: z
      .string()
      .trim()
      .min(1, 'La categoría es obligatoria')
      .max(50, 'Categoría demasiado larga'),
    fotos: z
      .array(z.string().url('Cada foto debe ser una URL válida'))
      .min(1, 'Debe incluir al menos 1 foto')
      .max(4, 'Máximo 4 fotos por anuncio'),
    whatsapp: z
      .string()
      .trim()
      .regex(
        telefonoColombianoRegex,
        'El teléfono debe ser colombiano de 10 dígitos y empezar por 3'
      ),
    lat: z.number().min(-90).max(90).nullable().optional().default(null),
    lng: z.number().min(-180).max(180).nullable().optional().default(null),
  })
  .strict();

export const actualizarEstadoAnuncioSchema = z
  .object({
    estado: z.literal('vendido', {
      errorMap: () => ({ message: 'El estado solo puede ser "vendido"' }),
    }),
  })
  .strict();

export const adminOcultarAnuncioSchema = z
  .object({
    estado: z.literal('oculto', {
      errorMap: () => ({ message: 'El estado solo puede ser "oculto"' }),
    }),
  })
  .strict();

export const reportarAnuncioSchema = z
  .object({
    motivo: z
      .string()
      .trim()
      .min(3, 'El motivo debe tener al menos 3 caracteres')
      .max(300, 'El motivo no puede exceder 300 caracteres'),
  })
  .strict();

export const favoritoPutSchema = z
  .object({
    anuncio_id: z.string().trim().min(1, 'anuncio_id es obligatorio'),
  })
  .strip();
