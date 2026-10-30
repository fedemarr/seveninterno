import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  MapPin,
  Check,
  Users,
  Trophy,
  Clock3,
} from "lucide-react";
import { Header, Footer } from "@/components/header";
import { ClubVideo } from "@/components/video";
import { getPublic } from "@/lib/data";
import { time } from "@/lib/utils";
export const dynamic = "force-dynamic";
export default async function Home() {
  const data = await getPublic();
  const open = data.event.registration_open;
  const next = data.matches.find((m) => m.status !== "finished");
  const team = (id: string | null) =>
    data.teams.find((t) => t.id === id)?.name ?? "Por definir";
  return (
    <>
      <Header />
      <main id="contenido">
        <section className="hero">
          <div className="hero-photo">
            <Image
              src="/media/club.jpeg"
              alt="La familia de Los Cedros reunida en la cancha del club"
              fill
              priority
              sizes="(max-width: 760px) 100vw, 75vw"
            />
            <div className="photo-shade" />
          </div>
          <div className="hero-content">
            <div className="eyebrow">
              <span className="line" /> LOS CEDROS RUGBY CLUB{" "}
              <span className="edition-tag">EDICIÓN ESPECIAL</span>
            </div>
            <h1>
              SEVEN
              <br />
              <span>INTERNO</span>
              <i aria-hidden="true">↗</i>
            </h1>
            <div className="tribute">
              <span className="tribute-line" />
              <div>
                <h2>ANTONIO “TONY” LEYES</h2>
                <p>10° ANIVERSARIO</p>
              </div>
            </div>
            <p className="hero-description">
              Volvemos a encontrarnos donde más nos gusta.
              <br />
              Rugby, amigos y una historia que nos une.
            </p>
            <div className="hero-buttons">
              <Link href="/inscripcion" className="btn btn-primary">
                Quiero ser parte <ArrowUpRight size={20} />
              </Link>
              <Link href="/fixture" className="hero-secondary">
                Seguir el torneo <ArrowRight size={18} />
              </Link>
            </div>
            <div className="hero-details">
              <span>
                <MapPin size={16} /> Club Los Cedros
              </span>
              <span>
                <CalendarDays size={16} />
                {data.event.event_date
                  ? new Intl.DateTimeFormat("es-AR", {
                      day: "numeric",
                      month: "long",
                      timeZone: "UTC",
                    }).format(new Date(data.event.event_date + "T12:00:00Z"))
                  : "Fecha a confirmar"}
              </span>
            </div>
          </div>
          <div className="hero-stamp">
            <span>UNA MISMA CAMISETA.</span>
            <strong>
              UNA MISMA
              <br />
              FAMILIA.
            </strong>
            <span className="stamp-line" />
          </div>
          <div className="hero-photo-credit">NUESTRA CASA. NUESTRA GENTE.</div>
        </section>
        <div className="motto-strip">
          <span>RUGBY QUE NOS ENCUENTRA</span>
          <span className="strip-star">✳</span>
          <strong>CEDRENSE SIEMPRE</strong>
          <span className="strip-star">✳</span>
          <span>10 AÑOS DE HISTORIA</span>
          <span className="strip-star">✳</span>
          <strong>TONY LEYES</strong>
        </div>
        <section className="section event-overview">
          <div className="overview-intro">
            <p className="eyebrow yellow">EL CLUB ES EL PUNTO DE ENCUENTRO</p>
            <h2>
              Un seven.
              <br />
              <span>Toda la familia.</span>
            </h2>
            <p>
              Una jornada para compartir adentro y afuera de la cancha. Armamos
              los equipos, nos ponemos la camiseta y hacemos lo que mejor
              sabemos: vivir el club.
            </p>
            <Link href="/inscripcion" className="text-link">
              Sumate a esta edición <ArrowUpRight size={19} />
            </Link>
          </div>
          <div className="overview-items">
            <article>
              <span className="feature-icon">
                <Users size={24} />
              </span>
              <div>
                <h3>Hay un lugar para vos</h3>
                <p>
                  Plantel Superior, Padres, Veteranos y juveniles de M14 a M19,
                  en competencias según su elegibilidad.
                </p>
              </div>
              <span className="item-number">01</span>
            </article>
            <article>
              <span className="feature-icon">
                <Trophy size={24} />
              </span>
              <div>
                <h3>Equipos parejos. Rugby de verdad.</h3>
                <p>
                  Planteles equilibrados para disfrutar cada partido y jugar por
                  las copas.
                </p>
              </div>
              <span className="item-number">02</span>
            </article>
            <article>
              <span className="feature-icon">
                <Clock3 size={24} />
              </span>
              <div>
                <h3>Todo el torneo, a mano</h3>
                <p>
                  Equipos, horarios, canchas y resultados en un solo lugar,
                  desde tu celular.
                </p>
              </div>
              <span className="item-number">03</span>
            </article>
          </div>
        </section>
        <section className="live-section">
          <div className="section live-inner">
            <div className="section-heading">
              <div>
                <p className="eyebrow">
                  <span className="status-dot" /> EL SEVEN, PARTIDO A PARTIDO
                </p>
                <h2>
                  Seguí la <span>acción.</span>
                </h2>
              </div>
              <Link href="/fixture" className="btn btn-outline">
                Ver fixture <ArrowUpRight size={18} />
              </Link>
            </div>
            <div className="live-grid">
              <div className="next-match">
                <div className="card-label">
                  PRÓXIMO PARTIDO{" "}
                  <span>
                    {next ? `CANCHA ${next.court}` : "EN PREPARACIÓN"}
                  </span>
                </div>
                {next ? (
                  <>
                    <div className="match-versus">
                      <strong>{team(next.home_id)}</strong>
                      <span>VS</span>
                      <strong>{team(next.away_id)}</strong>
                    </div>
                    <p>
                      {time(next.starts_at)} HS ·{" "}
                      {next.phase === "group"
                        ? `Grupo ${next.group_name}`
                        : "Copa"}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="empty-match">
                      <Trophy size={38} strokeWidth={1} />
                      <h3>La cancha se está preparando.</h3>
                      <p>
                        Cuando la organización publique el fixture,
                        <br />
                        vas a encontrar acá el próximo partido.
                      </p>
                    </div>
                  </>
                )}
              </div>
              <Link href="/equipos" className="quick-card">
                <Users size={27} />
                <span>LOS PROTAGONISTAS</span>
                <h3>
                  Conocé
                  <br />
                  los equipos.
                </h3>
                <ArrowUpRight className="quick-arrow" size={26} />
                <small>
                  {data.teams.length
                    ? `${data.teams.length} equipos publicados`
                    : "Próximamente, los planteles"}
                </small>
              </Link>
              <Link href="/posiciones" className="quick-card blue">
                <Trophy size={27} />
                <span>EL CAMINO A LAS COPAS</span>
                <h3>
                  Cada punto
                  <br />
                  cuenta.
                </h3>
                <ArrowUpRight className="quick-arrow" size={26} />
                <small>Grupos y tabla de posiciones</small>
              </Link>
            </div>
          </div>
        </section>
        <section className="section club-section">
          <ClubVideo />
          <div className="club-copy">
            <p className="eyebrow yellow">MUCHO MÁS QUE 7 CONTRA 7</p>
            <h2>
              Hay cosas
              <br />
              que se llevan
              <br />
              <span>para siempre.</span>
            </h2>
            <p>
              El abrazo después del partido. Los amigos de toda la vida. Los que
              recién se suman y los que siempre están.
            </p>
            <p>
              Este Seven lleva el nombre de Tony Leyes. Un encuentro para honrar
              nuestra historia y seguir construyéndola juntos.
            </p>
            <div className="anniversary">
              <strong>10°</strong>
              <div>
                ANIVERSARIO<small>ANTONIO “TONY” LEYES</small>
              </div>
            </div>
          </div>
        </section>
        <section className="section join-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow yellow">ASÍ DE SIMPLE</p>
              <h2>
                Tu lugar en <span>la cancha.</span>
              </h2>
            </div>
            <span className="status-badge">
              {open ? "Inscripciones abiertas" : "Inscripciones próximamente"}
            </span>
          </div>
          <div className="steps-grid">
            {[
              {
                n: "01",
                title: "Completá tus datos",
                text: "Elegí tu categoría y posición. Si sos menor, necesitás la autorización de tu responsable.",
              },
              {
                n: "02",
                title: "Transferí y mandá el comprobante",
                text: "Al inscribirte vas a ver los datos de pago. Enviá el comprobante por WhatsApp a Fede o Bauti.",
              },
              {
                n: "03",
                title: "Nos vemos en el club",
                text: "La organización confirma tu pago y publica los equipos. Vos prepará los botines.",
              },
            ].map((step) => (
              <article key={step.n}>
                <span>{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
          <div className="join-bottom">
            <span>
              <Check size={18} /> La confirmación del pago la realiza la
              organización.
            </span>
            <Link href="/inscripcion" className="btn btn-primary">
              Inscribirme al Seven <ArrowUpRight size={20} />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
