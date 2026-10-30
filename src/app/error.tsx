"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="contenido" className="section public-empty">
      <h1>No pudimos cargar esta página.</h1>
      <p>
        Volvé a intentarlo. Si el problema continúa, contactá a la organización.
      </p>
      <button className="btn btn-primary" onClick={reset}>
        Intentar de nuevo
      </button>
    </main>
  );
}
