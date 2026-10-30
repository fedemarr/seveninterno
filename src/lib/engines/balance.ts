export interface BalancePlayer {
  id: string;
  age?: number;
  level: "A" | "B" | "C" | null;
  group: "forward" | "back";
  position: string;
  secondaryPositions?: string[];
  paid: boolean;
  eligible: boolean;
  available: boolean;
  excluded?: boolean;
  lockedTeam?: number;
  together?: string[];
  separate?: string[];
}
export interface BalanceOptions {
  teamCount?: number;
  playersPerTeam: number;
  substitutes: number;
  seed: number;
}
export interface BalanceTeam {
  index: number;
  playerIds: string[];
  strength: number;
  forwards: number;
  backs: number;
  averageAge?: number;
  minors?: number;
}
const strength = (p: BalancePlayer) =>
  p.level === "A" ? 3 : p.level === "C" ? 1 : 2;
export function generateBalancedTeams(
  input: BalancePlayer[],
  options: BalanceOptions,
) {
  const players = input.filter(
    (p) => p.paid && p.eligible && p.available && !p.excluded,
  );
  const capacity = options.playersPerTeam + options.substitutes;
  const count =
    options.teamCount ?? Math.max(2, Math.ceil(players.length / capacity));
  if (
    !Number.isInteger(capacity) ||
    options.playersPerTeam < 7 ||
    options.substitutes < 0 ||
    !Number.isInteger(count) ||
    count < 2 ||
    count > 24
  )
    throw new Error(
      "Usá al menos 7 titulares, suplentes no negativos y entre 2 y 24 equipos.",
    );
  if (
    players.length < count * options.playersPerTeam ||
    players.length > count * capacity
  )
    throw new Error(
      "La cantidad de jugadores no permite completar los equipos con la capacidad elegida.",
    );
  const ids = new Set(players.map((p) => p.id));
  if (ids.size !== players.length) throw new Error("Hay jugadores duplicados.");
  const parent = new Map(players.map((p) => [p.id, p.id]));
  function root(id: string): string {
    const p = parent.get(id)!;
    return p === id ? p : root(p);
  }
  for (const p of players)
    for (const other of p.together ?? []) {
      if (!ids.has(other))
        throw new Error(
          "Una restricción de mantener juntos refiere a un jugador no habilitado.",
        );
      parent.set(root(other), root(p.id));
    }
  const units = new Map<string, BalancePlayer[]>();
  for (const p of players) {
    const key = root(p.id);
    units.set(key, [...(units.get(key) ?? []), p]);
  }
  for (const unit of units.values())
    for (const p of unit) {
      if ((p.separate ?? []).some((id) => unit.some((q) => q.id === id)))
        throw new Error(
          "Hay restricciones contradictorias de mantener juntos y separados.",
        );
      if (
        p.lockedTeam !== undefined &&
        (!Number.isInteger(p.lockedTeam) ||
          p.lockedTeam < 0 ||
          p.lockedTeam >= count)
      )
        throw new Error("Un bloqueo refiere a un equipo inexistente.");
    }
  const sorted = [...units.values()].sort(
    (a, b) =>
      Number(b.some((p) => p.lockedTeam !== undefined)) -
        Number(a.some((p) => p.lockedTeam !== undefined)) ||
      b.length - a.length ||
      b.reduce((s, p) => s + strength(p), 0) -
        a.reduce((s, p) => s + strength(p), 0) ||
      a[0].id.localeCompare(b[0].id),
  );
  let best: BalanceTeam[] | null = null;
  let bestCost = Infinity;
  const average = players.reduce((s, p) => s + strength(p), 0) / count;
  const byId = new Map(players.map((p) => [p.id, p]));
  const knownAges = players.filter((p) => p.age !== undefined);
  const averageAge = knownAges.length
    ? knownAges.reduce((s, p) => s + p.age!, 0) / knownAges.length
    : 0;
  const minorRatio = knownAges.length
    ? knownAges.filter((p) => p.age! < 18).length / knownAges.length
    : 0;
  const ageStats = (members: BalancePlayer[]) => {
    const known = members.filter((p) => p.age !== undefined);
    return {
      count: known.length,
      total: known.reduce((s, p) => s + p.age!, 0),
      minors: known.filter((p) => p.age! < 18).length,
    };
  };
  const ageCost = (members: BalancePlayer[]) => {
    const ages = ageStats(members);
    return (
      Math.abs(ages.total - averageAge * ages.count) * 0.15 +
      Math.abs(ages.minors - minorRatio * ages.count) * 5
    );
  };
  for (let attempt = 0; attempt < 80; attempt++) {
    const teams: BalanceTeam[] = Array.from({ length: count }, (_, index) => ({
      index,
      playerIds: [],
      strength: 0,
      forwards: 0,
      backs: 0,
    }));
    let failed = false;
    for (const unit of sorted) {
      const locked = [
        ...new Set(
          unit.flatMap((p) =>
            p.lockedTeam === undefined ? [] : [p.lockedTeam],
          ),
        ),
      ];
      if (locked.length > 1)
        throw new Error(
          "Jugadores que deben permanecer juntos tienen bloqueos incompatibles.",
        );
      const candidates = teams.filter(
        (t) =>
          (!locked.length || t.index === locked[0]) &&
          t.playerIds.length + unit.length <= capacity &&
          !unit.some((p) =>
            players.some(
              (q) =>
                t.playerIds.includes(q.id) &&
                ((p.separate ?? []).includes(q.id) ||
                  (q.separate ?? []).includes(p.id)),
            ),
          ),
      );
      if (!candidates.length) {
        failed = true;
        break;
      }
      const cost = (t: BalanceTeam) => {
        const size = t.playerIds.length + unit.length,
          power = t.strength + unit.reduce((s, p) => s + strength(p), 0);
        const fw =
          t.forwards + unit.filter((p) => p.group === "forward").length;
        const tie =
          ((t.index * 17 + attempt * 13 + options.seed * 7) % 29) / 29;
        return (
          size * 12 +
          power * 3 +
          Math.abs(fw - (size * 3) / 7) * 2 +
          ageCost([...t.playerIds.map((id) => byId.get(id)!), ...unit]) +
          tie * (attempt ? 8 : 0)
        );
      };
      const target = candidates.sort((a, b) => cost(a) - cost(b))[0];
      for (const p of unit) {
        target.playerIds.push(p.id);
        target.strength += strength(p);
        target[p.group === "forward" ? "forwards" : "backs"]++;
      }
    }
    if (
      failed ||
      teams.some((t) => t.playerIds.length < options.playersPerTeam)
    )
      continue;
    const sizes = teams.map((t) => t.playerIds.length);
    const total =
      teams.reduce(
        (s, t) =>
          s +
          (t.strength - average) ** 2 +
          ageCost(t.playerIds.map((id) => byId.get(id)!)) +
          Math.abs(t.forwards - (t.playerIds.length * 3) / 7) * 2,
        0,
      ) +
      (Math.max(...sizes) - Math.min(...sizes)) * 20;
    if (total < bestCost) {
      best = teams;
      bestCost = total;
    }
  }
  if (!best)
    throw new Error(
      "No se encontró una distribución que respete las restricciones. Revisá bloqueos, capacidad y jugadores juntos/separados.",
    );
  const warnings: string[] = [];
  if (players.some((p) => !p.level))
    warnings.push(
      "Hay jugadores sin evaluar: se usó nivel intermedio provisional.",
    );
  if (best.some((t) => t.forwards < 3 || t.backs < 4))
    warnings.push(
      "Algún equipo no alcanza la referencia de 3 forwards y 4 backs. Revisá posiciones alternativas.",
    );
  if (
    best.some(
      (t) =>
        !t.playerIds.some((id) => {
          const p = players.find((p) => p.id === id)!;
          return [p.position, ...(p.secondaryPositions ?? [])].some(
            (x) => x === "Medio scrum" || x === "Apertura",
          );
        }),
    )
  )
    warnings.push("Algún equipo no tiene medio scrum o apertura declarado.");
  return {
    teams: best.map((team) => {
      const ages = ageStats(team.playerIds.map((id) => byId.get(id)!));
      return {
        ...team,
        averageAge: ages.count
          ? Math.round(ages.total / ages.count)
          : undefined,
        minors: ages.minors,
      };
    }),
    warnings,
    score: Math.max(0, Math.round(100 - bestCost / players.length)),
    seed: options.seed,
  };
}
export function suggestLateTeam(
  player: BalancePlayer,
  teams: BalanceTeam[],
  capacity: number,
) {
  if (!player.paid || !player.eligible || !player.available || player.excluded)
    throw new Error(
      "El jugador debe estar habilitado, disponible y con pago confirmado.",
    );
  return teams
    .filter(
      (t) =>
        t.playerIds.length < capacity &&
        (player.lockedTeam === undefined || t.index === player.lockedTeam) &&
        !(player.separate ?? []).some((id) => t.playerIds.includes(id)) &&
        !(player.together ?? []).some((id) => !t.playerIds.includes(id)),
    )
    .map((t) => ({
      teamIndex: t.index,
      cost:
        t.playerIds.length * 10 +
        t.strength +
        Math.abs(
          t.forwards +
            (player.group === "forward" ? 1 : 0) -
            ((t.playerIds.length + 1) * 3) / 7,
        ),
    }))
    .sort((a, b) => a.cost - b.cost);
}
