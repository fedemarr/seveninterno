import { Header, Footer } from "@/components/header";
import { RegistrationForm } from "@/components/registration-form";
import { getPublic } from "@/lib/data";
import {
  ArrowDownRight,
  CalendarDays,
  MessageCircle,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { money } from "@/lib/utils";
import { registrationFee } from "@/lib/pricing";
export const dynamic = "force-dynamic";
export const metadata = { title: "Inscripción" };
export default async function Inscription() {
  const data = await getPublic();
  const prices = new Map<number, string[]>();
  for (const category of data.categories) {
    const amount = registrationFee(data.event, category);
    const names = prices.get(amount) ?? [];
    names.push(
      category.name === "Vetecedros"
        ? "Vetecedros / exjugadores"
        : category.name,
    );
    prices.set(amount, names);
  }
  return (
    <>
      <Header />
      <main id="contenido" className="section registration-layout">
        <aside className="registration-intro">
          <p className="eyebrow yellow">10° ANIVERSARIO · TONY LEYES</p>
          <h1>
            El Seven
            <br />
            empieza
            <br />
            <span>con vos.</span>
          </h1>
          <div className="registration-schedule">
            <CalendarDays size={24} aria-hidden="true" />
            <div>
              <time dateTime={data.event.event_date ?? undefined}>
                {data.event.event_date
                  ? new Intl.DateTimeFormat("es-AR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      timeZone: "UTC",
                    }).format(new Date(`${data.event.event_date}T12:00:00Z`))
                  : "Fecha a confirmar"}
              </time>
              <strong>Comienza a las 11:00 hs</strong>
            </div>
          </div>
          <p>
            Completá tus datos y preparate para volver a encontrarnos en la
            cancha.
          </p>
          <p>
            Durante la jornada vamos a contar con comida, frutas, barras de
            cereal y bebidas.
          </p>
          <ArrowDownRight size={56} strokeWidth={1} />
          <div className="registration-facts">
            <div>
              <Wallet size={21} />
              <span>
                Inscripción
                <strong>Según tu categoría</strong>
              </span>
            </div>
            <div>
              <MessageCircle size={21} />
              <span>
                Pago por transferencia<strong>Comprobante por WhatsApp</strong>
              </span>
            </div>
            <div>
              <ShieldCheck size={21} />
              <span>
                Confirmación manual<strong>A cargo de la organización</strong>
              </span>
            </div>
          </div>
          <dl
            className="registration-prices"
            aria-label="Precios por categoría"
          >
            {[...prices]
              .sort(([a], [b]) => a - b)
              .map(([amount, names]) => (
                <div key={amount}>
                  <dt>{names.join(" · ")}</dt>
                  <dd>{amount > 0 ? money(amount) : "Importe a confirmar"}</dd>
                </div>
              ))}
          </dl>
          <small>
            ¿Necesitás ayuda?{" "}
            <a
              href="https://wa.me/5491127056803"
              target="_blank"
              rel="noreferrer"
            >
              Hablá con Fede ↗
            </a>{" "}
            o{" "}
            <a
              href="https://wa.me/5491131202929"
              target="_blank"
              rel="noreferrer"
            >
              Bauti ↗
            </a>
            .
          </small>
        </aside>
        <div className="form-panel">
          <RegistrationForm
            categories={data.categories}
            positions={data.positions}
            event={data.event}
            connected={data.connected}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
