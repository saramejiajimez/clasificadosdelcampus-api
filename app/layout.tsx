import type { ReactNode } from 'react';

export const metadata = {
  title: '35 · Clasificados del Campus API',
  description: 'API REST para compra y venta entre estudiantes',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
