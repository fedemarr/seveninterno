import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/errors";
import { sameOrigin } from "@/lib/request";
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request))
      return NextResponse.json({ error: "Origen inválido." }, { status: 403 });
    const data = z
      .object({ email: z.email(), password: z.string().min(8).max(200) })
      .parse(await request.json());
    const db = await supabaseServer();
    const { data: session, error } = await db.auth.signInWithPassword(data);
    if (error)
      return NextResponse.json(
        {
          error:
            "Email o contraseña incorrectos. Verificá los datos e intentá de nuevo.",
        },
        { status: 401 },
      );
    const { data: admin } = await db
      .from("admin_users")
      .select("id")
      .eq("id", session.user!.id)
      .single();
    if (!admin) {
      await db.auth.signOut();
      throw new Error("FORBIDDEN");
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 400 });
  }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Origen inválido." }, { status: 403 });
  const db = await supabaseServer();
  await db.auth.signOut();
  return NextResponse.json({ success: true });
}
