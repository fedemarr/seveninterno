import { NextResponse } from "next/server";
import { commandSchema } from "@/lib/commands";
import { getAdmin, requireAdmin } from "@/lib/data";
import { generateBalancedTeams } from "@/lib/engines/balance";
import {
  TournamentFormatEngine,
  classify,
  resolveSlots,
  validateSchedule,
  type FormatPlan,
} from "@/lib/engines/tournament";
import { errorMessage } from "@/lib/errors";
import { supabaseService } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/request";
import { normalizedPhone } from "@/lib/validation";
import { eligibleForCompetition } from "@/lib/competition-setup";
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request))
      return NextResponse.json({ error: "Origen inválido." }, { status: 403 });
    if (Number(request.headers.get("content-length") ?? 0) > 40000)
      throw new Error("La solicitud es demasiado grande.");
    const { user, role } = await requireAdmin();
    const parsed = commandSchema.parse(await request.json());
    const { command, version } = parsed;
    if (
      role === "scorer" &&
      !["match.result", "match.update"].includes(command.type)
    )
      throw new Error("FORBIDDEN");
    const snapshot = await getAdmin();
    if (snapshot.event.version !== version) throw new Error("STALE_VERSION");
    if (command.type === "event.create" && role !== "owner")
      throw new Error("FORBIDDEN");
    if (
      command.type === "event.update" &&
      command.data.registration_open &&
      (!command.data.event_date ||
        command.data.amount <= 0 ||
        !command.data.alias.trim() ||
        !command.data.holder.trim())
    )
      throw new Error(
        "Completá fecha, importe, alias y titular antes de abrir las inscripciones.",
      );
    if (
      command.type === "competition.create" &&
      (command.data.min_age > command.data.max_age ||
        (command.data.min_age < 18 &&
          command.data.max_age >= 18 &&
          (!command.data.allow_mixed_ages ||
            command.data.authorization_note.trim().length < 10)))
    )
      throw new Error(
        "Revisá el rango de edades y documentá la autorización para competencias mixtas.",
      );
    if (command.type === "player.details") {
      const r = snapshot.registrations.find((r) => r.id === command.data.id);
      if (!r) throw new Error("El jugador no existe.");
      if (
        snapshot.members.some((m) => m.registration_id === r.id) &&
        (r.age !== command.data.input.age ||
          r.category_id !== command.data.input.category_id)
      )
        throw new Error(
          "Quitá al jugador del equipo antes de cambiar su edad o categoría.",
        );
    }
    if (command.type === "member.swap") {
      const a = snapshot.members.find(
          (m) => m.registration_id === command.data.first_id,
        ),
        b = snapshot.members.find(
          (m) => m.registration_id === command.data.second_id,
        );
      if (!a || !b || a.team_id === b.team_id)
        throw new Error("Elegí dos jugadores de equipos distintos.");
      if (
        snapshot.event.state === "TORNEO_EN_CURSO" &&
        !command.data.impact_confirmed
      )
        throw new Error(
          "Revisá las reglas de participación y confirmá el intercambio.",
        );
      for (const [member, target] of [
        [a, b.team_id],
        [b, a.team_id],
      ] as const) {
        const player = snapshot.registrations.find(
          (r) => r.id === member.registration_id,
        )!;
        const team = snapshot.teams.find((t) => t.id === target)!;
        const comp = snapshot.competitions.find(
          (c) => c.id === team.competition_id,
        )!;
        if (
          !player.active ||
          player.payment_status !== "PAGO_CONFIRMADO" ||
          !player.available ||
          player.excluded ||
          !comp.category_ids.includes(player.category_id) ||
          player.age < comp.min_age ||
          player.age > comp.max_age
        )
          throw new Error("INELIGIBLE_PLAYER");
        const others = snapshot.members
          .filter(
            (m) =>
              m.team_id === target &&
              m.registration_id !== command.data.first_id &&
              m.registration_id !== command.data.second_id,
          )
          .map((m) =>
            snapshot.registrations.find((r) => r.id === m.registration_id)!,
          );
        if (
          others.some(
            (other) =>
              player.separate_from.includes(other.id) ||
              other.separate_from.includes(player.id),
          ) ||
          player.together_with.some((id) => !others.some((o) => o.id === id))
        )
          throw new Error(
            "El intercambio viola una restricción de mantener juntos o separados.",
          );
      }
    }
    let type: string = command.type;
    let data: unknown = command.data;
    let preview: unknown = null;
    if (command.type === "player.evaluate") {
      const player = snapshot.registrations.find(
        (p) => p.id === command.data.id,
      );
      if (!player || !player.active)
        throw new Error(
          "El jugador no existe o su inscripción está dada de baja.",
        );
      type = "player.update";
      data = {
        id: player.id,
        level: command.data.level,
        active: player.active,
        notes: player.notes,
        secondary_positions: player.secondary_positions,
        available: player.available,
        assignment_locked: player.assignment_locked,
        excluded: player.excluded,
        together_with: player.together_with,
        separate_from: player.separate_from,
      };
    }
    if (command.type === "player.create")
      data = { ...command.data, phone: normalizedPhone(command.data.phone) };
    if (command.type === "player.details")
      data = {
        ...command.data,
        input: {
          ...command.data.input,
          phone: normalizedPhone(command.data.input.phone),
        },
      };
    const competitionId =
      "competition_id" in command.data ? command.data.competition_id : "";
    if (
      competitionId &&
      !snapshot.competitions.some((c) => c.id === competitionId)
    )
      throw new Error("La competencia no existe.");
    if (
      command.type === "proposal.generate" ||
      command.type === "teams.confirm"
    ) {
      const competition = snapshot.competitions.find(
        (c) => c.id === competitionId,
      )!;
      const existing = snapshot.teams.filter(
        (t) => t.competition_id === competitionId,
      );
      const players = snapshot.registrations.map((r) => {
        const position = snapshot.positions.find(
          (p) => p.id === r.position_id,
        )!;
        const current = snapshot.members.find(
          (m) => m.registration_id === r.id,
        );
        return {
          id: r.id,
          level: r.level,
          group: position.group,
          position: position.name,
          secondaryPositions: r.secondary_positions,
          paid: r.payment_status === "PAGO_CONFIRMADO",
          available: r.available && r.active,
          eligible: eligibleForCompetition(
            r,
            competition,
            snapshot.teams,
            snapshot.members,
          ),
          excluded: r.excluded,
          together: r.together_with,
          separate: r.separate_from,
          lockedTeam:
            current && (r.assignment_locked || current.locked)
              ? existing.findIndex((t) => t.id === current.team_id)
              : undefined,
        };
      });
      const result = generateBalancedTeams(players, command.data.options);
      if (command.type === "proposal.generate") {
        type = "proposal.save";
        data = {
          competition_id: competitionId,
          proposal: { ...result, options: command.data.options },
        };
        preview = result;
      } else {
        if (existing.length) throw new Error("TEAMS_ALREADY_EXIST");
        type = "teams.confirm";
        data = {
          competition_id: competitionId,
          teams: result.teams.map((t) => ({
            name: `Equipo ${t.index + 1}`,
            playerIds: t.playerIds,
          })),
        };
      }
    }
    if (command.type === "tournament.generate") {
      const teams = snapshot.teams.filter(
        (t) => t.competition_id === competitionId,
      );
      const plan = new TournamentFormatEngine().generate(
        teams.map((t) => t.id),
        command.data.settings,
        { eventId: snapshot.event.id, competitionId },
      );
      const conflicts = validateSchedule(
        [
          ...snapshot.matches.filter((m) => m.competition_id !== competitionId),
          ...plan.matches,
        ],
        command.data.settings.restMinutes,
      );
      if (conflicts.length)
        throw new Error(
          `${conflicts[0]} Reservá otra franja horaria para esta competencia o cambiá la cantidad de canchas.`,
        );
      type = "tournament.save";
      data = { competition_id: competitionId, plan };
      preview = plan;
    }
    if (command.type === "classify") {
      const saved = snapshot.plans.find(
        (p) => p.competition_id === competitionId,
      );
      if (!saved) throw new Error("Generá primero el torneo.");
      const plan = {
        ...saved.plan,
        matches: snapshot.matches.filter(
          (m) => m.competition_id === competitionId,
        ),
      } as FormatPlan;
      const seeds = classify(plan);
      const resolved = resolveSlots(plan.matches, seeds);
      type = "results.apply";
      data = { matches: resolved };
    }
    if (command.type === "member.move") {
      if (
        ["TORNEO_EN_CURSO", "TORNEO_FINALIZADO"].includes(
          snapshot.event.state,
        ) &&
        !command.data.impact_confirmed
      )
        throw new Error(
          "Confirmá que revisaste las reglas de participación para el cambio durante el torneo.",
        );
      const target = snapshot.teams.find((t) => t.id === command.data.team_id);
      const player = snapshot.registrations.find(
        (r) => r.id === command.data.registration_id,
      );
      if (target && player) {
        const members = snapshot.members.filter(
          (m) => m.team_id === target.id && m.registration_id !== player.id,
        );
        if (player.excluded || !player.available)
          throw new Error("El jugador está excluido o no disponible.");
        if (
          player.together_with.some(
            (id) => !members.some((m) => m.registration_id === id),
          ) ||
          snapshot.registrations.some(
            (other) =>
              other.together_with.includes(player.id) &&
              !members.some((m) => m.registration_id === other.id),
          )
        )
          throw new Error(
            "La asignación separaría jugadores que deben permanecer juntos. Revisá las restricciones.",
          );
        for (const member of members) {
          const other = snapshot.registrations.find(
            (r) => r.id === member.registration_id,
          )!;
          if (
            player.separate_from.includes(other.id) ||
            other.separate_from.includes(player.id)
          )
            throw new Error(
              "Estos jugadores tienen una restricción de separación.",
            );
        }
      }
    }
    if (command.type === "match.result") {
      const m = snapshot.matches.find((m) => m.id === command.data.id);
      if (!m || !m.home_id || !m.away_id)
        throw new Error("El partido todavía no tiene ambos equipos definidos.");
      if (snapshot.event.state !== "TORNEO_EN_CURSO")
        throw new Error(
          "Activá TORNEO EN CURSO desde Configuración para cargar resultados.",
        );
      const {
        home_score: home,
        away_score: away,
        winner_id: explicit,
      } = command.data;
      const winner =
        home > away
          ? m.home_id
          : away > home
            ? m.away_id
            : m.phase === "group"
              ? null
              : explicit;
      if (
        m.phase !== "group" &&
        (!winner || ![m.home_id, m.away_id].includes(winner))
      )
        throw new Error("Elegí el ganador del desempate de esta copa.");
      let matches = snapshot.matches.map((x) => ({ ...x }));
      const dependent = new Set<string>();
      if (m.status === "finished") {
        if (m.phase === "group")
          matches
            .filter(
              (x) =>
                x.competition_id === m.competition_id && x.phase !== "group",
            )
            .forEach((x) => dependent.add(x.id));
        else {
          dependent.add(m.id);
          for (let i = 0; i < matches.length; i++)
            for (const x of matches)
              if (
                [x.home_source, x.away_source].some(
                  (s) => s?.startsWith("winner:") && dependent.has(s.slice(7)),
                )
              )
                dependent.add(x.id);
          dependent.delete(m.id);
        }
        if (dependent.size && !command.data.correct_dependents)
          throw new Error(
            "La corrección afecta cruces posteriores. Confirmá la anulación de resultados dependientes para continuar.",
          );
        matches = matches.map((x) =>
          dependent.has(x.id)
            ? {
                ...x,
                status: "scheduled" as const,
                home_score: null,
                away_score: null,
                winner_id: null,
                home_id: x.home_source ? null : x.home_id,
                away_id: x.away_source ? null : x.away_id,
              }
            : x,
        );
      }
      matches = matches.map((x) =>
        x.id === m.id
          ? {
              ...x,
              home_score: home,
              away_score: away,
              winner_id: winner,
              status: "finished",
            }
          : x,
      );
      const saved = snapshot.plans.find(
        (p) => p.competition_id === m.competition_id,
      );
      const compMatches = matches.filter(
        (x) => x.competition_id === m.competition_id,
      );
      let seeds: Record<string, string> = {};
      if (
        saved &&
        compMatches
          .filter((x) => x.phase === "group")
          .every((x) => x.status === "finished")
      )
        seeds = classify({ ...saved.plan, matches: compMatches });
      const resolved = resolveSlots(compMatches, seeds);
      type = "results.apply";
      data = { matches: resolved };
    }
    if (command.type === "match.update") {
      const current = snapshot.matches.find((m) => m.id === command.data.id);
      if (!current) throw new Error("El partido no existe.");
      if (current.status === "finished")
        throw new Error(
          "Corregí el resultado para modificar un partido terminado.",
        );
      if (
        command.data.status === "live" &&
        (!current.home_id ||
          !current.away_id ||
          snapshot.event.state !== "TORNEO_EN_CURSO")
      )
        throw new Error(
          "El torneo debe estar en curso y los equipos definidos.",
        );
      const plan = snapshot.plans.find(
        (p) => p.competition_id === current.competition_id,
      )?.plan;
      if (command.data.court > (plan?.settings.courts ?? 8))
        throw new Error("La cancha no está configurada para esta competencia.");
      const matches = snapshot.matches.map((m) =>
        m.id === current.id ? { ...m, ...command.data } : m,
      );
      const conflicts = validateSchedule(
        matches,
        plan?.settings.restMinutes ?? 14,
      );
      if (conflicts.length) throw new Error(conflicts[0]);
    }
    const { error } = await supabaseService().rpc("admin_apply", {
      command: { type, data, version, actor_id: user.id },
    });
    if (error) throw new Error(error.message);
    return NextResponse.json(
      { success: true, preview },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
