import Link from "next/link";
export default function NotFound() {
  return (
    <main id="contenido" className="section public-empty">
      <p className="eyebrow yellow">404 · FUERA DE LA CANCHA</p>
      <h1>No encontramos esa página.</h1>
      <Link className="btn btn-primary" href="/">
        Volver al inicio
      </Link>
    </main>
  );
}
