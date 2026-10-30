import { Header, Footer } from "@/components/header";
import { RegistrationForm } from "@/components/registration-form";
import { getPublic } from "@/lib/data";
import {
  ArrowDownRight,
  MessageCircle,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { money } from "@/lib/utils";
export const dynamic = "force-dynamic";
export const metadata = { title: "Inscripción" };
export default async function Inscription() {
  const data = await getPublic();
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
          <p>
            Completá tus datos y preparate para volver a encontrarnos en la
            cancha.
          </p>
          <ArrowDownRight size={56} strokeWidth={1} />
          <div className="registration-facts">
            <div>
              <Wallet size={21} />
              <span>
                Inscripción
                <strong>
                  {data.event.amount > 0
                    ? money(data.event.amount)
                    : "Importe a confirmar"}
                </strong>
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
