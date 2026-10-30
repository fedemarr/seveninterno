import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck, Menu } from "lucide-react";
export function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="Los Cedros · Inicio">
        <Image
          src="/media/escudo.png"
          alt="Escudo de Los Cedros"
          width={48}
          height={54}
          priority
        />
        <span>
          LOS CEDROS<small>RUGBY CLUB</small>
        </span>
      </Link>
      <nav className="main-nav" aria-label="Navegación principal">
        <Link href="/equipos">Equipos</Link>
        <Link href="/fixture">Fixture</Link>
        <Link href="/posiciones">Posiciones</Link>
        <Link href="/copas">Copas</Link>
      </nav>
      <div className="header-actions">
        <details className="mobile-menu">
          <summary aria-label="Abrir navegación">
            <Menu size={20} />
          </summary>
          <nav aria-label="Navegación en celular">
            <Link href="/equipos">Equipos</Link>
            <Link href="/fixture">Fixture y resultados</Link>
            <Link href="/posiciones">Posiciones</Link>
            <Link href="/copas">Copas</Link>
          </nav>
        </details>
        <Link href="/admin" className="admin-link" aria-label="Administración">
          <ShieldCheck size={19} />
          <span>Organización</span>
        </Link>
        <Link href="/inscripcion" className="btn btn-primary btn-sm">
          Inscribirme <ArrowUpRight size={17} />
        </Link>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <Link href="/" className="brand">
        <Image
          src="/media/escudo.png"
          alt="Los Cedros"
          width={36}
          height={42}
        />
        <span>
          LOS CEDROS<small>SEVEN INTERNO · TONY LEYES</small>
        </span>
      </Link>
      <strong>
        CEDRENSE <span>SIEMPRE.</span>
      </strong>
      <div>
        <Link href="/privacidad">Privacidad y condiciones</Link>
        <small>Una misma camiseta. Una misma familia.</small>
      </div>
    </footer>
  );
}
