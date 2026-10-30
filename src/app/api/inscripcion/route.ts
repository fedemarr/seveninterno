import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { registrationSchema, normalizedPhone } from "@/lib/validation";
import { supabaseService } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/errors";
import { sameOrigin } from "@/lib/request";
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request))
      return NextResponse.json({ error: "Origen inválido." }, { status: 403 });
    if (Number(request.headers.get("content-length") ?? 0) > 16000)
      return NextResponse.json(
        { error: "El formulario excede el tamaño permitido." },
        { status: 413 },
      );
    const input = registrationSchema.parse(await request.json());
    if (!process.env.RATE_LIMIT_SECRET) throw new Error("SETUP_REQUIRED");
    const ip = process.env.VERCEL
      ? (request.headers.get("x-vercel-forwarded-for") ?? "shared")
      : "local";
    const hash = createHmac("sha256", process.env.RATE_LIMIT_SECRET)
      .update(ip)
      .digest("hex");
    const { data, error } = await supabaseService().rpc("register_player", {
      payload: { ...input, phone: normalizedPhone(input.phone) },
      ip_hash: hash,
    });
    if (error) throw new Error(error.message);
    if (data.error) throw new Error(data.error);
    return NextResponse.json(
      { success: true, data },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
