import type { Metadata } from "next";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-800.css";
import "@fontsource/inter/latin-900.css";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Seven Interno · Tony Leyes · Los Cedros",
    template: "%s | Seven Interno Los Cedros",
  },
  description:
    "Seven Interno Antonio “Tony” Leyes. 10° aniversario. Inscripción y seguimiento del torneo de Los Cedros Rugby Club. Cedrense siempre.",
  icons: { icon: "/media/escudo.png" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-AR">
      <body>
        <a href="#contenido" className="skip-link">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
