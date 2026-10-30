import { redirect, notFound } from "next/navigation";
import { configured } from "@/lib/supabase/server";
import { getAdmin } from "@/lib/data";
import { AdminPanel } from "@/components/admin-panel";
import { ADMIN_PATHS } from "@/lib/admin-sections";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Organización",
  robots: { index: false, follow: false },
};
export default async function AdminPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  const path = section?.join("/") ?? "dashboard";
  if (!ADMIN_PATHS.includes(path)) notFound();
  if (!configured()) redirect("/login");
  let data;
  try {
    data = await getAdmin();
  } catch {
    redirect("/login");
  }
  return <AdminPanel key={path} data={data} section={path} />;
}
