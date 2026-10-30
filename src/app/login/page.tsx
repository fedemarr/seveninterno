import { Header, Footer } from "@/components/header";
import { LoginForm } from "@/components/login-form";
import { configured } from "@/lib/supabase/server";
export const metadata = { title: "Acceso organización" };
export default function Login() {
  return (
    <>
      <Header />
      <main id="contenido" className="login-page">
        <div className="form-panel login-panel">
          <p className="eyebrow">ACCESO PRIVADO</p>
          <h1>
            Detrás del <span>Seven.</span>
          </h1>
          <p>Ingresá con tu cuenta de organización.</p>
          <LoginForm configured={configured()} />
        </div>
      </main>
      <Footer />
    </>
  );
}
