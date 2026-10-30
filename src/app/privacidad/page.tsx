import { Header, Footer } from "@/components/header";
export default function Privacy() {
  return (
    <>
      <Header />
      <main id="contenido" className="section prose">
        <p className="eyebrow yellow">LOS CEDROS · SEVEN INTERNO</p>
        <h1>Privacidad y participación</h1>
        <h2>Para qué usamos tus datos</h2>
        <p>
          La organización usa nombre, apellido, edad, categoría, posición y
          teléfono para inscribir participantes, verificar pagos, armar equipos
          y coordinar el torneo. Los datos del responsable se solicitan para
          participantes menores de 18 años.
        </p>
        <h2>Información pública</h2>
        <p>
          El portal muestra equipos, fixture y resultados. Solo se publica el
          nombre e inicial de apellido de participantes mayores de edad que lo
          autoricen. No se publican teléfonos, datos del responsable,
          evaluaciones deportivas ni observaciones privadas. Los nombres de
          menores no se muestran en los planteles públicos.
        </p>
        <h2>Participación y pago</h2>
        <p>
          La inscripción queda pendiente hasta que la organización confirme el
          pago. La transferencia y el envío del comprobante por WhatsApp son
          manuales. La categoría, elegibilidad y participación final están
          sujetas a revisión por la organización. Los menores necesitan
          autorización de su madre, padre o tutor.
        </p>
        <h2>Consultas y derechos</h2>
        <p>
          Podés pedir acceso, corrección o supresión de tus datos a Fede al{" "}
          <a href="https://wa.me/5491127056803">11 2705-6803</a> o Bauti al{" "}
          <a href="https://wa.me/5491131202929">11 3120-2929</a>. La
          organización debe revisar los plazos de conservación y este texto
          antes de abrir las inscripciones.
        </p>
      </main>
      <Footer />
    </>
  );
}
