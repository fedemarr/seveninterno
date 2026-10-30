import { notFound } from "next/navigation";
import { Header, Footer } from "@/components/header";
import { PublicPortal } from "@/components/public-portal";
import { getPublic } from "@/lib/data";
export const dynamic = "force-dynamic";
export default async function PublicPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!["equipos", "fixture", "posiciones", "copas"].includes(section))
    notFound();
  const data = await getPublic();
  return (
    <>
      <Header />
      <main id="contenido" className="section public-portal">
        <PublicPortal data={data} section={section} />
      </main>
      <Footer />
    </>
  );
}
