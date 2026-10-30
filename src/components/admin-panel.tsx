"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Wallet,
  Users,
  ChartNoAxesColumnIncreasing,
  Shirt,
  Shuffle,
  Settings2,
  CalendarDays,
  Radio,
  Trophy,
  Settings,
  ArrowUpRight,
  LogOut,
  Plus,
  Search,
  CheckCircle2,
  LoaderCircle,
  X,
  Save,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import type { AdminSnapshot } from "@/lib/data";
import type { AdminCommand } from "@/lib/commands";
import {
  DEFAULT_SETTINGS,
  EVENT_STATES,
  PAYMENT_STATES,
  type Registration,
  type TournamentSettings,
} from "@/lib/domain";
import { money } from "@/lib/utils";
import { Button } from "./ui/button";
import { RegistrationForm } from "./registration-form";
import { QuickEvaluations } from "./quick-evaluations";
import { CompetitionSetup } from "./competition-setup";
import { AutomaticTeams } from "./automatic-teams";
import { eligibleForCompetition } from "@/lib/competition-setup";
import { LateAssignment } from "./late-assignment";
import {
  MatchCard,
  StandingsTables,
  CupBrackets,
  teamLabel,
} from "./tournament-view";
import type { FormatPlan } from "@/lib/engines/tournament";
import type { generateBalancedTeams } from "@/lib/engines/balance";
export const ADMIN_SECTIONS = [
  { path: "dashboard", name: "Dashboard", icon: LayoutDashboard },
  { path: "inscripciones", name: "Inscripciones", icon: ClipboardList },
  { path: "pagos", name: "Pagos", icon: Wallet },
  { path: "jugadores", name: "Jugadores", icon: Users },
  {
    path: "evaluaciones",
    name: "Evaluaciones",
    icon: ChartNoAxesColumnIncreasing,
  },
  { path: "equipos", name: "Equipos", icon: Shirt },
  { path: "generador", name: "Generador de equipos", icon: Shuffle },
  {
    path: "configuracion-torneo",
    name: "Configuración del torneo",
    icon: Settings2,
  },
  { path: "fixture", name: "Fixture", icon: CalendarDays },
  { path: "torneo", name: "Modo Torneo", icon: Radio },
  { path: "resultados", name: "Resultados", icon: CheckCircle2 },
  { path: "copas", name: "Copas", icon: Trophy },
  { path: "configuracion", name: "Configuración", icon: Settings },
];
type Proposal = ReturnType<typeof generateBalancedTeams> & {
  options: {
    playersPerTeam: number;
    substitutes: number;
    teamCount?: number;
    seed: number;
  };
};
const asNumber = (fd: FormData, key: string) => Number(fd.get(key));
const checked = (fd: FormData, key: string) => fd.get(key) === "on";
const text = (fd: FormData, key: string) => String(fd.get(key) ?? "");
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}
function Form({
  onSubmit,
  children,
  className = "",
}: {
  onSubmit: (fd: FormData) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      {children}
    </form>
  );
}
export function AdminPanel({
  data: d,
  section,
}: {
  data: AdminSnapshot;
  section: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [category, setCategory] = useState(""),
    [selectedCompetition, setCompetition] = useState(
      d.competitions[0]?.id ?? "",
    ),
    [editing, setEditing] = useState<Registration | null>(null),
    [adding, setAdding] = useState(false),
    [preview, setPreview] = useState<Proposal | null>(null),
    [planPreview, setPlanPreview] = useState<FormatPlan | null>(null);
  const [options, setOptions] = useState({
    playersPerTeam: 7,
    substitutes: 3,
    teamCount: undefined as number | undefined,
    seed: 1,
  });
  const [matchEdit, setMatchEdit] = useState<string | null>(null);
  const competition = selectedCompetition || d.competitions[0]?.id || "";
  const selectedGroup = d.competitions.find((c) => c.id === competition);
  const readyPlayers = selectedGroup
    ? d.registrations.filter((p) =>
        eligibleForCompetition(p, selectedGroup, d.teams, d.members),
      )
    : [];
  const groupTeamCount =
    options.teamCount ??
    Math.max(
      2,
      Math.ceil(
        readyPlayers.length / (options.playersPerTeam + options.substitutes),
      ),
    );
  const neededPlayers = groupTeamCount * options.playersPerTeam;
  const tooManyPlayers =
    readyPlayers.length >
    groupTeamCount * (options.playersPerTeam + options.substitutes);
  const modalOpen = Boolean(editing) || adding;
  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button,input,select,textarea,a[href]",
        ) ?? [],
      ).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
      );
    focusable()[0]?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditing(null);
        setAdding(false);
      }
      if (e.key === "Tab") {
        const nodes = focusable(),
          first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [modalOpen]);
  const loading = busy || pending;
  async function act(command: AdminCommand, success = "Cambios guardados.") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: d.event.version, command }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage(
        result.automatic_notice
          ? `${success} ${result.automatic_notice}`
          : success,
      );
      startTransition(() => router.refresh());
      return result.preview;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const run = (command: AdminCommand, success?: string) => {
    void act(command, success).catch(() => {});
  };
  const paid = d.registrations.filter(
    (r) => r.payment_status === "PAGO_CONFIRMADO" && r.active,
  );
  const filtered = d.registrations.filter(
    (r) =>
      `${r.first_name} ${r.last_name} ${r.phone}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!status || r.payment_status === status) &&
      (!category || r.category_id === category),
  );
  const playerName = (id: string) => {
    const r = d.registrations.find((r) => r.id === id);
    return r ? `${r.first_name} ${r.last_name}` : "Jugador";
  };
  const compTeams = d.teams.filter((t) => t.competition_id === competition),
    compMatches = d.matches.filter(
      (m) => !competition || m.competition_id === competition,
    );
  const compPlan = d.plans.find((p) => p.competition_id === competition)?.plan;
  const compSelect = (
    <Field
      label={section === "generador" ? "Jugadores a incluir" : "Competencia"}
    >
      <select
        value={competition}
        onChange={(e) => {
          setCompetition(e.target.value);
          setPreview(null);
          setPlanPreview(null);
        }}
      >
        <option value="">Seleccioná una competencia</option>
        {d.competitions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </Field>
  );
  const confirm = (
    message: string,
    command: AdminCommand,
    success?: string,
  ) => {
    if (window.confirm(message)) run(command, success);
  };
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="brand">
          <Image
            src="/media/escudo.png"
            alt="Los Cedros"
            width={40}
            height={48}
          />
          <span>
            SEVEN INTERNO<small>ORGANIZACIÓN</small>
          </span>
        </Link>
        <div className="admin-edition">
          TONY LEYES <span>10° ANIVERSARIO</span>
        </div>
        <nav aria-label="Administración">
          {ADMIN_SECTIONS.map(({ path, name, icon: Icon }) => (
            <Link
              key={path}
              href={path === "dashboard" ? "/admin" : `/admin/${path}`}
              aria-current={section === path ? "page" : undefined}
            >
              <Icon size={18} />
              {name}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span>
            <ShieldCheck size={16} />{" "}
            {d.role === "scorer" ? "Resultados" : "Administración"}
          </span>
          <Link href="/" target="_blank">
            Ver portal público <ArrowUpRight size={16} />
          </Link>
          <button
            onClick={async () => {
              await fetch("/api/auth", { method: "DELETE" });
              router.push("/login");
              router.refresh();
            }}
          >
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>
      <main id="contenido" className="admin-main">
        <div className="admin-topbar">
          <span>LOS CEDROS / ORGANIZACIÓN</span>
          <span className="admin-state">
            {d.event.state.replaceAll("_", " ")}
          </span>
        </div>
        <div className="admin-content">
          <div className="admin-heading">
            <div>
              <p className="eyebrow">SEVEN INTERNO · TONY LEYES</p>
              <h1>{ADMIN_SECTIONS.find((s) => s.path === section)?.name}</h1>
            </div>
            {["dashboard", "inscripciones", "jugadores"].includes(section) &&
              d.role !== "scorer" && (
                <Button onClick={() => setAdding(true)}>
                  <Plus size={18} /> Agregar jugador
                </Button>
              )}
          </div>
          <div aria-live="polite">
            {loading && (
              <p className="admin-notice">
                <LoaderCircle className="spin" size={16} /> Guardando…
              </p>
            )}
            {message && (
              <p className="admin-notice success">
                <CheckCircle2 size={18} />
                {message}
              </p>
            )}
            {error && (
              <p className="admin-notice error" role="alert">
                {error}{" "}
                <button onClick={() => router.refresh()}>
                  Actualizar datos
                </button>
              </p>
            )}
          </div>
          {section === "dashboard" && (
            <>
              <div className="stats-grid">
                {[
                  {
                    title: "Inscriptos",
                    value: d.registrations.filter((r) => r.active).length,
                    sub: "en esta edición",
                  },
                  {
                    title: "Pagos confirmados",
                    value: paid.length,
                    sub: `${d.registrations.filter((r) => r.active && r.payment_status !== "PAGO_CONFIRMADO").length} pendientes de confirmación`,
                  },
                  {
                    title: "Sin evaluación",
                    value: paid.filter((r) => !r.level).length,
                    sub: "jugadores habilitados",
                  },
                  {
                    title: "Sin equipo",
                    value: paid.filter(
                      (r) => !d.members.some((m) => m.registration_id === r.id),
                    ).length,
                    sub: "listos para asignar",
                  },
                  {
                    title: "Equipos",
                    value: d.teams.length,
                    sub: `${d.competitions.length} competencias`,
                  },
                  {
                    title: "Recaudación registrada",
                    value: money(d.payment_total ?? 0),
                    sub: "importes registrados al confirmar cada pago",
                  },
                ].map((s) => (
                  <article className="stat-card" key={s.title}>
                    <span>{s.title}</span>
                    <strong>{s.value}</strong>
                    <small>{s.sub}</small>
                  </article>
                ))}
              </div>
              <div className="admin-two-cols">
                <section className="admin-card">
                  <h2>Próximos partidos</h2>
                  {d.matches
                    .filter((m) => m.status !== "finished")
                    .slice(0, 3)
                    .map((m) => (
                      <MatchCard
                        key={m.id}
                        match={m}
                        teams={d.teams}
                        matches={d.matches}
                      />
                    ))}
                  {!d.matches.length && (
                    <p className="muted">
                      Generá equipos y configurá el torneo para ver los próximos
                      encuentros.
                    </p>
                  )}
                  <Link href="/admin/torneo" className="text-link">
                    Abrir Modo Torneo <ArrowRight size={16} />
                  </Link>
                </section>
                <section className="admin-card">
                  <h2>Actividad reciente</h2>
                  <div className="audit-list">
                    {d.audit.slice(0, 10).map((a) => (
                      <div key={a.id}>
                        <span>{a.action}</span>
                        <small>
                          {new Date(a.created_at).toLocaleString("es-AR", {
                            timeZone: "America/Argentina/Buenos_Aires",
                          })}{" "}
                          · {a.actor_id?.slice(0, 8) ?? "Inscripción pública"}
                        </small>
                      </div>
                    ))}
                    {!d.audit.length && (
                      <p className="muted">
                        Todavía no hay operaciones registradas.
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </>
          )}
          {section === "evaluaciones" && (
            <QuickEvaluations
              players={d.registrations}
              busy={loading}
              readOnly={d.role === "scorer"}
              onRate={(player, level) =>
                run(
                  { type: "player.evaluate", data: { id: player.id, level } },
                  `Nivel ${level} guardado para ${player.first_name} ${player.last_name}.`,
                )
              }
            />
          )}
          {["inscripciones", "pagos", "jugadores"].includes(section) && (
            <>
              <div className="admin-toolbar">
                <label className="search-input">
                  <Search size={17} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar nombre o teléfono"
                  />
                </label>
                <select
                  aria-label="Filtrar categoría"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Todas las categorías</option>
                  {d.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filtrar pago"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Todos los pagos</option>
                  {PAYMENT_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="admin-card table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Jugador</th>
                      <th>Categoría / posición</th>
                      <th>Pago</th>
                      <th>Nivel privado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <strong>
                            {r.first_name} {r.last_name}
                          </strong>
                          <small>
                            {r.age} años · {r.phone} {!r.active && " · BAJA"}
                          </small>
                        </td>
                        <td>
                          {
                            d.categories.find((c) => c.id === r.category_id)
                              ?.name
                          }
                          <small>
                            {
                              d.positions.find((p) => p.id === r.position_id)
                                ?.name
                            }
                          </small>
                        </td>
                        <td>
                          <select
                            disabled={loading || d.role === "scorer"}
                            aria-label={`Pago de ${r.first_name}`}
                            value={r.payment_status}
                            onChange={(e) =>
                              confirm(
                                `¿Cambiar el pago de ${r.first_name} a ${e.target.value.replaceAll("_", " ")}? Esta operación se audita.`,
                                {
                                  type: "payment.update",
                                  data: {
                                    id: r.id,
                                    status: e.target
                                      .value as Registration["payment_status"],
                                  },
                                },
                              )
                            }
                          >
                            {PAYMENT_STATES.map((s) => (
                              <option key={s} value={s}>
                                {s.replaceAll("_", " ")}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <span className={`level level-${r.level ?? "none"}`}>
                            {r.level ?? "Sin evaluar"}
                          </span>
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={d.role === "scorer"}
                            onClick={() => setEditing(r)}
                          >
                            Editar / evaluar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filtered.length && (
                  <div className="admin-empty">
                    <Users size={32} />
                    <h3>No hay jugadores con estos filtros.</h3>
                    <p>
                      Las inscripciones van a aparecer acá cuando se reciban.
                    </p>
                  </div>
                )}
              </div>
              <p className="admin-footnote">
                Los niveles, teléfonos, responsables y observaciones nunca se
                muestran en el portal público.
              </p>
            </>
          )}
          {section === "generador" && selectedGroup && (
            <AutomaticTeams
              data={d}
              competitionId={competition}
              busy={loading}
              onConfigure={(command) =>
                run(command, "Configuración automática guardada.")
              }
            />
          )}
          {section === "generador" && !selectedGroup?.automatic_teams && (
            <>
              <section className="admin-card">
                <h2>Propuesta de equipos equilibrados</h2>
                <p className="muted">
                  Solo jugadores activos, disponibles, elegibles y con pago
                  confirmado. Generar guarda un borrador; confirmar crea los
                  equipos sin publicarlos.
                </p>
                {d.competitions.length ? (
                  <>
                    {d.competitions.length > 1 ? (
                      compSelect
                    ) : (
                      <div className="generator-readiness">
                        <strong>Un solo Seven: de M14 a Veteranos</strong>
                        <p>
                          Todas las categorías juegan mezcladas. El generador
                          reparte niveles, edades y posiciones.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <CompetitionSetup
                    categories={d.categories}
                    competitions={d.competitions}
                    players={d.registrations}
                    busy={loading}
                    onCreate={(data) =>
                      run(
                        { type: "competition.create", data },
                        "Seven preparado con todas las categorías.",
                      )
                    }
                  />
                )}
                <div className="form-grid four-cols">
                  <Field label="Titulares por equipo">
                    <input
                      type="number"
                      min={7}
                      max={15}
                      value={options.playersPerTeam}
                      onChange={(e) => {
                        setOptions({
                          ...options,
                          playersPerTeam: +e.target.value,
                        });
                        setPreview(null);
                      }}
                    />
                  </Field>
                  <Field label="Suplentes">
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={options.substitutes}
                      onChange={(e) => {
                        setOptions({
                          ...options,
                          substitutes: +e.target.value,
                        });
                        setPreview(null);
                      }}
                    />
                  </Field>
                  <Field label="Cantidad de equipos">
                    <input
                      type="number"
                      min={2}
                      max={24}
                      placeholder="Automática"
                      value={options.teamCount ?? ""}
                      onChange={(e) => {
                        setOptions({
                          ...options,
                          teamCount: e.target.value
                            ? +e.target.value
                            : undefined,
                        });
                        setPreview(null);
                      }}
                    />
                  </Field>
                  <Field label="Semilla reproducible">
                    <input
                      type="number"
                      min={0}
                      max={1000000}
                      value={options.seed}
                      onChange={(e) => {
                        setOptions({ ...options, seed: +e.target.value });
                        setPreview(null);
                      }}
                    />
                  </Field>
                </div>
                {selectedGroup && (
                  <div
                    className={`generator-readiness ${readyPlayers.length < neededPlayers || tooManyPlayers ? "needs-players" : ""}`}
                  >
                    <strong>
                      {readyPlayers.length} jugadores listos en{" "}
                      {selectedGroup.name}
                    </strong>
                    <p>
                      {readyPlayers.length < neededPlayers
                        ? `Necesitás al menos ${neededPlayers} jugadores habilitados para ${groupTeamCount} equipos de ${options.playersPerTeam}.`
                        : tooManyPlayers
                          ? "La capacidad elegida no alcanza: sumá equipos o suplentes."
                          : `Podés armar ${groupTeamCount} equipos. La propuesta se guarda sin publicarla.`}
                    </p>
                    {readyPlayers.length < neededPlayers && (
                      <Link href="/admin/pagos">
                        Revisar pagos pendientes →
                      </Link>
                    )}
                  </div>
                )}
                <Button
                  disabled={
                    !competition ||
                    loading ||
                    readyPlayers.length < neededPlayers ||
                    tooManyPlayers
                  }
                  onClick={async () => {
                    try {
                      const p = await act(
                        {
                          type: "proposal.generate",
                          data: { competition_id: competition, options },
                        },
                        "Propuesta guardada. Revisá el balance antes de confirmar.",
                      );
                      setPreview({ ...p, options });
                    } catch {}
                  }}
                >
                  <Shuffle size={18} /> Generar propuesta
                </Button>
                {preview && (
                  <div className="proposal-preview">
                    <h3>Balance: {preview.score}/100</h3>
                    {preview.warnings.map((w) => (
                      <p className="form-alert" key={w}>
                        {w}
                      </p>
                    ))}
                    <div className="stats-grid">
                      {preview.teams.map((t) => (
                        <article className="stat-card" key={t.index}>
                          <span>Equipo {t.index + 1}</span>
                          <strong>{t.playerIds.length} jugadores</strong>
                          <small>
                            Nivel total {t.strength} · {t.forwards} forwards ·{" "}
                            {t.backs} backs
                          </small>
                          {t.averageAge !== undefined && (
                            <small>
                              Edad promedio {t.averageAge} años · {t.minors}{" "}
                              menores
                            </small>
                          )}
                          <p>{t.playerIds.map(playerName).join(", ")}</p>
                        </article>
                      ))}
                    </div>
                    <Button
                      disabled={loading || !!compTeams.length}
                      onClick={() =>
                        confirm(
                          "¿Confirmar esta distribución y crear los equipos? Todavía no se publicarán.",
                          {
                            type: "teams.confirm",
                            data: {
                              competition_id: competition,
                              options: preview.options,
                            },
                          },
                          "Equipos creados. Revisalos en el editor y publicalos cuando estén listos.",
                        )
                      }
                    >
                      <CheckCircle2 size={18} /> Confirmar equipos
                    </Button>
                    {!!compTeams.length && (
                      <p>
                        La competencia ya tiene equipos. Usá el editor manual.
                      </p>
                    )}
                  </div>
                )}
              </section>
              <section className="admin-card">
                <h2>Comparar propuestas guardadas</h2>
                {d.proposals
                  .filter((p) => p.competition_id === competition)
                  .map((p) => {
                    const prop = p.proposal as Proposal;
                    return (
                      <details key={p.id}>
                        <summary>
                          {new Date(p.created_at).toLocaleString("es-AR")} ·
                          Balance {prop.score}/100 · Semilla {prop.seed}
                        </summary>
                        <div className="teams-grid">
                          {prop.teams.map((t) => (
                            <div key={t.index}>
                              <h3>Equipo {t.index + 1}</h3>
                              <p>{t.playerIds.map(playerName).join(", ")}</p>
                              <small>
                                {t.forwards} forwards · {t.backs} backs · Nivel{" "}
                                {t.strength}
                              </small>
                            </div>
                          ))}
                        </div>
                      </details>
                    );
                  })}
                {!d.proposals.some((p) => p.competition_id === competition) && (
                  <p className="muted">
                    No hay propuestas guardadas para esta competencia.
                  </p>
                )}
              </section>
            </>
          )}
          {section === "equipos" && (
            <>
              <div className="admin-toolbar">
                {compSelect}
                <Button
                  disabled={!compTeams.length || loading}
                  onClick={() =>
                    confirm(
                      "¿Publicar estos equipos en el portal? Los nombres de menores y los datos privados permanecerán ocultos.",
                      {
                        type: "teams.publish",
                        data: { competition_id: competition },
                      },
                      "Equipos publicados.",
                    )
                  }
                >
                  <ArrowUpRight size={18} /> Publicar equipos
                </Button>
              </div>
              <div className="teams-grid admin-teams">
                {compTeams.map((t) => (
                  <section className="admin-card" key={`${t.id}-${t.version}`}>
                    <Form
                      onSubmit={(fd) =>
                        run({
                          type: "team.update",
                          data: {
                            id: t.id,
                            name: text(fd, "name"),
                            color: text(fd, "color"),
                          },
                        })
                      }
                    >
                      <div className="team-title-edit">
                        <input
                          aria-label="Nombre del equipo"
                          name="name"
                          defaultValue={t.name}
                          required
                          minLength={2}
                          maxLength={60}
                        />
                        <input
                          aria-label="Color del equipo"
                          name="color"
                          type="color"
                          defaultValue={t.color}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loading}
                          aria-label="Guardar nombre y color"
                        >
                          <Save size={17} />
                        </Button>
                      </div>
                    </Form>
                    <p className="muted">
                      {t.published ? "Publicado" : "Borrador"} ·{" "}
                      {d.members.filter((m) => m.team_id === t.id).length}{" "}
                      jugadores · Nivel total{" "}
                      {d.members
                        .filter((m) => m.team_id === t.id)
                        .reduce((s, m) => {
                          const l = d.registrations.find(
                            (r) => r.id === m.registration_id,
                          )?.level;
                          return s + (l === "A" ? 3 : l === "C" ? 1 : 2);
                        }, 0)}
                    </p>
                    {d.members
                      .filter((m) => m.team_id === t.id)
                      .map((m) => (
                        <details key={m.id} className="member-editor">
                          <summary>
                            {playerName(m.registration_id)}{" "}
                            {m.captain ? "· C" : ""}
                            {m.substitute ? " · S" : ""}
                            {m.locked ? " · Bloqueado" : ""}
                          </summary>
                          <Form
                            onSubmit={(fd) =>
                              run({
                                type: "member.move",
                                data: {
                                  registration_id: m.registration_id,
                                  team_id: text(fd, "team"),
                                  captain: checked(fd, "captain"),
                                  substitute: checked(fd, "substitute"),
                                  locked: checked(fd, "locked"),
                                  override_lock: checked(fd, "override"),
                                  impact_confirmed: checked(fd, "impact"),
                                },
                              })
                            }
                          >
                            <Field label="Mover a">
                              <select name="team" defaultValue={t.id}>
                                <option value="">Quitar del plantel</option>
                                {d.teams.map((team) => (
                                  <option key={team.id} value={team.id}>
                                    {team.name} ·{" "}
                                    {
                                      d.competitions.find(
                                        (c) => c.id === team.competition_id,
                                      )?.name
                                    }
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <label className="check-label">
                              <input
                                type="checkbox"
                                name="captain"
                                defaultChecked={m.captain}
                              />
                              Capitán
                            </label>
                            <label className="check-label">
                              <input
                                type="checkbox"
                                name="substitute"
                                defaultChecked={m.substitute}
                              />
                              Suplente
                            </label>
                            <label className="check-label">
                              <input
                                type="checkbox"
                                name="locked"
                                defaultChecked={m.locked}
                              />
                              Bloquear asignación
                            </label>
                            <label className="check-label">
                              <input type="checkbox" name="override" />
                              Autorizar cambio de un bloqueo previo
                            </label>
                            <label className="check-label">
                              <input type="checkbox" name="impact" />
                              Revisé las reglas de participación para este
                              cambio
                            </label>
                            <Button disabled={loading} size="sm">
                              Guardar movimiento
                            </Button>
                          </Form>
                        </details>
                      ))}
                  </section>
                ))}
              </div>
              {!compTeams.length && (
                <div className="admin-empty">
                  <Shirt size={40} />
                  <h3>Todavía no hay equipos.</h3>
                  <Link href="/admin/generador" className="btn btn-primary">
                    Ir al generador
                  </Link>
                </div>
              )}
              <section className="admin-card">
                <h2>Asignar jugador sin equipo / alta tardía</h2>
                <p className="muted">
                  Los nuevos pagos no alteran planteles publicados. Cada
                  incorporación necesita aprobación manual y queda auditada.
                </p>
                <Form
                  className="form-grid"
                  onSubmit={(fd) =>
                    run({
                      type: "member.move",
                      data: {
                        registration_id: text(fd, "player"),
                        team_id: text(fd, "team"),
                        captain: false,
                        substitute: checked(fd, "substitute"),
                        locked: false,
                        override_lock: false,
                        impact_confirmed: checked(fd, "impact"),
                      },
                    })
                  }
                >
                  <Field label="Jugador habilitado">
                    <select name="player" required>
                      <option value="">Seleccionar</option>
                      {paid
                        .filter(
                          (r) =>
                            !d.members.some((m) => m.registration_id === r.id),
                        )
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.first_name} {r.last_name} ·{" "}
                            {r.level ?? "Sin evaluar"}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Equipo de destino">
                    <select name="team" required>
                      <option value="">Seleccionar</option>
                      {compTeams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ·{" "}
                          {d.members.filter((m) => m.team_id === t.id).length}{" "}
                          jugadores
                        </option>
                      ))}
                    </select>
                  </Field>
                  <label className="check-label">
                    <input type="checkbox" name="substitute" />
                    Suplente
                  </label>
                  <label className="check-label">
                    <input type="checkbox" name="impact" />
                    Revisé las reglas de participación
                  </label>
                  <Button disabled={loading || !competition}>
                    Aprobar incorporación
                  </Button>
                </Form>
              </section>
            </>
          )}
          {section === "equipos" && (
            <>
              <LateAssignment
                data={d}
                competition={competition}
                busy={loading}
                onApply={(command) =>
                  confirm(
                    "¿Aprobar esta incorporación al plantel? No se reorganizará ningún otro equipo.",
                    command,
                  )
                }
              />
              <section className="admin-card">
                <h2>Intercambiar jugadores</h2>
                <Form
                  onSubmit={(fd) =>
                    confirm(
                      "¿Confirmar el intercambio de ambos jugadores? Las dos asignaciones se guardan juntas.",
                      {
                        type: "member.swap",
                        data: {
                          first_id: text(fd, "first"),
                          second_id: text(fd, "second"),
                          override_lock: checked(fd, "override"),
                          impact_confirmed: checked(fd, "impact"),
                        },
                      },
                    )
                  }
                >
                  <div className="form-grid">
                    {["first", "second"].map((name, i) => (
                      <Field label={`Jugador ${i + 1}`} key={name}>
                        <select name={name} required>
                          <option value="">Seleccionar</option>
                          {d.members.map((m) => (
                            <option value={m.registration_id} key={m.id}>
                              {playerName(m.registration_id)} ·{" "}
                              {d.teams.find((t) => t.id === m.team_id)?.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ))}
                  </div>
                  <label className="check-label">
                    <input type="checkbox" name="override" />
                    Autorizar cambios sobre asignaciones bloqueadas
                  </label>
                  <label className="check-label">
                    <input type="checkbox" name="impact" />
                    Revisé las reglas de participación del torneo
                  </label>
                  <Button disabled={loading}>Confirmar intercambio</Button>
                </Form>
              </section>
            </>
          )}
          {section === "configuracion-torneo" && (
            <>
              <section className="admin-card">
                <h2>Competencias y elegibilidad</h2>
                <p className="muted">
                  Un solo Seven con todas las categorías, desde M14 hasta
                  Veteranos. Los equipos mezclan edades y se equilibran por
                  nivel A/B/C y posiciones.
                </p>
                {!d.competitions.length && (
                  <CompetitionSetup
                    categories={d.categories}
                    competitions={d.competitions}
                    players={d.registrations}
                    busy={loading}
                    onCreate={(data) =>
                      run(
                        { type: "competition.create", data },
                        "Seven preparado con todas las categorías.",
                      )
                    }
                  />
                )}
                <div className="competition-list">
                  {d.competitions.map((c) => (
                    <div key={c.id}>
                      <strong>{c.name}</strong>
                      <span>
                        {c.min_age}–{c.max_age} años ·{" "}
                        {c.category_ids
                          .map(
                            (id) =>
                              d.categories.find((cat) => cat.id === id)?.name,
                          )
                          .join(", ")}
                      </span>
                      {c.authorization_note && (
                        <small>{c.authorization_note}</small>
                      )}
                    </div>
                  ))}
                </div>
              </section>
              <section className="admin-card">
                <h2>Generar torneo automáticamente</h2>
                {compSelect}
                <TournamentForm
                  settings={compPlan?.settings ?? DEFAULT_SETTINGS}
                  busy={loading || !competition}
                  eventDate={d.event.event_date}
                  onSubmit={async (settings) => {
                    try {
                      const plan = await act(
                        {
                          type: "tournament.generate",
                          data: { competition_id: competition, settings },
                        },
                        "Fixture guardado como borrador. Revisá antes de publicar.",
                      );
                      setPlanPreview(plan);
                    } catch {}
                  }}
                />
                {(planPreview ?? compPlan) && (
                  <div className="proposal-preview">
                    <h3>
                      Vista previa · {(planPreview ?? compPlan)!.groups.length}{" "}
                      grupos · {(planPreview ?? compPlan)!.matches.length}{" "}
                      partidos
                    </h3>
                    <p>
                      Fin estimado:{" "}
                      {new Date(
                        (planPreview ?? compPlan)!.endsAt,
                      ).toLocaleString("es-AR", {
                        timeZone: "America/Argentina/Buenos_Aires",
                      })}
                    </p>
                    {(planPreview ?? compPlan)!.warnings.map((w) => (
                      <p className="form-alert" key={w}>
                        {w}
                      </p>
                    ))}
                    <Button
                      disabled={loading}
                      onClick={() =>
                        confirm(
                          "¿Aprobar y publicar el fixture? Revisá el horario, las canchas, los descansos y los equipos.",
                          {
                            type: "tournament.publish",
                            data: { competition_id: competition },
                          },
                          "Fixture publicado.",
                        )
                      }
                    >
                      <CheckCircle2 size={18} /> Aprobar y publicar fixture
                    </Button>
                    <Link className="btn btn-outline" href="/admin/fixture">
                      Revisar partidos
                    </Link>
                  </div>
                )}
              </section>
            </>
          )}
          {["fixture", "torneo", "resultados", "copas"].includes(section) && (
            <>
              <div className="admin-toolbar">
                {compSelect}
                <Button
                  disabled={loading || !competition}
                  onClick={() =>
                    confirm(
                      "¿Confirmar clasificados de los grupos completos? Los cruces se actualizarán según las reglas guardadas.",
                      {
                        type: "classify",
                        data: { competition_id: competition },
                      },
                      "Clasificados confirmados.",
                    )
                  }
                >
                  <Trophy size={18} /> Confirmar clasificados
                </Button>
              </div>
              {section === "copas" ? (
                <CupBrackets matches={compMatches} teams={d.teams} />
              ) : (
                <>
                  <div className="matches-grid">
                    {compMatches
                      .filter(
                        (m) =>
                          section !== "resultados" || m.status === "finished",
                      )
                      .map((m) => (
                        <section
                          className="admin-card match-editor"
                          key={`${m.id}-${m.version}`}
                        >
                          <MatchCard
                            match={m}
                            teams={d.teams}
                            matches={d.matches}
                          />
                          <div className="match-actions">
                            <Button
                              disabled={loading}
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setMatchEdit(matchEdit === m.id ? null : m.id)
                              }
                            >
                              Editar / resultado
                            </Button>
                            {m.status === "scheduled" && (
                              <Button
                                disabled={loading || !m.home_id || !m.away_id}
                                size="sm"
                                onClick={() =>
                                  run({
                                    type: "match.update",
                                    data: {
                                      id: m.id,
                                      starts_at: m.starts_at,
                                      court: m.court,
                                      status: "live",
                                    },
                                  })
                                }
                              >
                                Iniciar
                              </Button>
                            )}
                          </div>
                          {matchEdit === m.id && (
                            <>
                              <Form
                                onSubmit={(fd) =>
                                  confirm(
                                    "¿Confirmar este marcador? Si corregís un resultado, revisá el efecto en las fases siguientes.",
                                    {
                                      type: "match.result",
                                      data: {
                                        id: m.id,
                                        home_score: asNumber(fd, "home"),
                                        away_score: asNumber(fd, "away"),
                                        winner_id: text(fd, "winner"),
                                        correct_dependents: checked(
                                          fd,
                                          "reset",
                                        ),
                                      },
                                    },
                                  )
                                }
                              >
                                <div className="form-grid">
                                  <Field
                                    label={teamLabel(
                                      m.home_id,
                                      m.home_source,
                                      d.teams,
                                      d.matches,
                                    )}
                                  >
                                    <input
                                      type="number"
                                      name="home"
                                      min={0}
                                      max={999}
                                      defaultValue={m.home_score ?? 0}
                                      required
                                    />
                                  </Field>
                                  <Field
                                    label={teamLabel(
                                      m.away_id,
                                      m.away_source,
                                      d.teams,
                                      d.matches,
                                    )}
                                  >
                                    <input
                                      type="number"
                                      name="away"
                                      min={0}
                                      max={999}
                                      defaultValue={m.away_score ?? 0}
                                      required
                                    />
                                  </Field>
                                </div>
                                {m.phase !== "group" && (
                                  <Field label="Ganador del desempate (si empatan)">
                                    <select name="winner">
                                      <option value="">
                                        Elegir si corresponde
                                      </option>
                                      {[m.home_id, m.away_id]
                                        .filter(Boolean)
                                        .map((id) => (
                                          <option key={id!} value={id!}>
                                            {
                                              d.teams.find((t) => t.id === id)
                                                ?.name
                                            }
                                          </option>
                                        ))}
                                    </select>
                                  </Field>
                                )}
                                <label className="check-label">
                                  <input type="checkbox" name="reset" />
                                  Autorizar anulación de cruces y resultados
                                  dependientes por esta corrección
                                </label>
                                <Button
                                  disabled={loading || !m.home_id || !m.away_id}
                                  size="sm"
                                >
                                  Confirmar resultado
                                </Button>
                              </Form>
                              {m.status !== "finished" && (
                                <Form
                                  onSubmit={(fd) =>
                                    run({
                                      type: "match.update",
                                      data: {
                                        id: m.id,
                                        starts_at: new Date(
                                          text(fd, "at"),
                                        ).toISOString(),
                                        court: asNumber(fd, "court"),
                                        status: m.status as
                                          "scheduled" | "live",
                                      },
                                    })
                                  }
                                >
                                  <div className="form-grid">
                                    <Field label="Fecha y hora (hora local)">
                                      <input
                                        type="datetime-local"
                                        name="at"
                                        defaultValue={toLocal(m.starts_at)}
                                        required
                                      />
                                    </Field>
                                    <Field label="Cancha">
                                      <input
                                        type="number"
                                        name="court"
                                        min={1}
                                        max={8}
                                        defaultValue={m.court}
                                      />
                                    </Field>
                                  </div>
                                  <Button
                                    disabled={loading}
                                    size="sm"
                                    variant="outline"
                                  >
                                    Reprogramar
                                  </Button>
                                </Form>
                              )}
                            </>
                          )}
                        </section>
                      ))}
                  </div>
                  {!compMatches.length && (
                    <div className="admin-empty">
                      <CalendarDays size={40} />
                      <h3>No hay partidos para esta competencia.</h3>
                      <Link
                        href="/admin/configuracion-torneo"
                        className="btn btn-primary"
                      >
                        Configurar torneo
                      </Link>
                    </div>
                  )}
                  {compPlan && (
                    <StandingsTables
                      plans={[{ competition_id: competition, plan: compPlan }]}
                      teams={d.teams}
                      matches={compMatches}
                    />
                  )}
                </>
              )}
            </>
          )}
          {section === "configuracion" && d.role === "owner" && (
            <section className="admin-card new-edition">
              <h2>Próxima edición</h2>
              <p className="muted">
                Al finalizar este torneo podés crear una nueva edición. Se
                conservan jugadores, resultados y auditoría anteriores; el nuevo
                evento empieza en borrador.
              </p>
              <Form
                onSubmit={(fd) =>
                  confirm(
                    "¿Archivar la edición actual y crear la siguiente? Sus datos históricos se conservarán.",
                    {
                      type: "event.create",
                      data: {
                        name: text(fd, "name"),
                        edition: text(fd, "edition"),
                      },
                    },
                    "Nueva edición creada en borrador.",
                  )
                }
              >
                <div className="form-grid">
                  <Field label="Nombre">
                    <input name="name" defaultValue="SEVEN INTERNO" required />
                  </Field>
                  <Field label="Edición">
                    <input
                      name="edition"
                      placeholder="Nombre de la nueva edición"
                      required
                    />
                  </Field>
                </div>
                <Button
                  disabled={loading || d.event.state !== "TORNEO_FINALIZADO"}
                >
                  Crear próxima edición
                </Button>
              </Form>
            </section>
          )}
          {section === "configuracion" && (
            <>
              <section className="admin-card">
                <h2>Evento e inscripciones</h2>
                <Form
                  key={d.event.version}
                  onSubmit={(fd) =>
                    run({
                      type: "event.update",
                      data: {
                        name: text(fd, "name"),
                        edition: text(fd, "edition"),
                        state: text(fd, "state") as typeof d.event.state,
                        registration_open: checked(fd, "open"),
                        late_registration: checked(fd, "late"),
                        amount: asNumber(fd, "amount"),
                        alias: text(fd, "alias"),
                        holder: text(fd, "holder"),
                        bank_account: text(fd, "bank"),
                        payment_instructions: text(fd, "instructions"),
                        event_date: text(fd, "date") || null,
                      },
                    })
                  }
                >
                  <div className="form-grid">
                    <Field label="Nombre">
                      <input name="name" defaultValue={d.event.name} required />
                    </Field>
                    <Field label="Edición">
                      <input
                        name="edition"
                        defaultValue={d.event.edition}
                        required
                      />
                    </Field>
                    <Field label="Estado del evento">
                      <select name="state" defaultValue={d.event.state}>
                        {EVENT_STATES.map((s) => (
                          <option key={s} value={s}>
                            {s.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Fecha del Seven">
                      <input
                        type="date"
                        name="date"
                        defaultValue={d.event.event_date ?? ""}
                      />
                    </Field>
                    <Field label="Importe de inscripción (ARS)">
                      <input
                        type="number"
                        name="amount"
                        min={0}
                        max={10000000}
                        defaultValue={d.event.amount}
                      />
                    </Field>
                    <Field label="Alias de transferencia">
                      <input name="alias" defaultValue={d.event.alias} />
                    </Field>
                    <Field label="Titular">
                      <input name="holder" defaultValue={d.event.holder} />
                    </Field>
                    <Field label="CBU / CVU (opcional)">
                      <input name="bank" defaultValue={d.event.bank_account} />
                    </Field>
                  </div>
                  <Field label="Instrucciones de pago">
                    <textarea
                      name="instructions"
                      defaultValue={d.event.payment_instructions}
                    />
                  </Field>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      name="open"
                      defaultChecked={d.event.registration_open}
                    />
                    Inscripciones públicas abiertas
                  </label>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      name="late"
                      defaultChecked={d.event.late_registration}
                    />
                    Permitir inscripciones públicas tardías
                  </label>
                  <p className="form-alert">
                    Los estados avanzan de a una etapa. Publicar equipos y
                    fixture requiere su aprobación en las pantallas
                    correspondientes.
                  </p>
                  <Button disabled={loading}>
                    <Save size={18} /> Guardar configuración
                  </Button>
                </Form>
              </section>
              <section className="admin-card">
                <h2>Reglas de edad por categoría</h2>
                {d.categories.map((c) => (
                  <Form
                    key={c.id}
                    className="category-rule"
                    onSubmit={(fd) =>
                      run({
                        type: "category.update",
                        data: {
                          id: c.id,
                          min_age: asNumber(fd, "min"),
                          max_age: asNumber(fd, "max"),
                        },
                      })
                    }
                  >
                    <strong>{c.name}</strong>
                    <Field label="Mínima">
                      <input
                        type="number"
                        name="min"
                        min={13}
                        max={90}
                        defaultValue={c.min_age}
                      />
                    </Field>
                    <Field label="Máxima">
                      <input
                        type="number"
                        name="max"
                        min={13}
                        max={90}
                        defaultValue={c.max_age}
                      />
                    </Field>
                    <Button size="sm" variant="outline" disabled={loading}>
                      Guardar
                    </Button>
                  </Form>
                ))}
              </section>
              <section className="admin-card">
                <h2>Auditoría</h2>
                <div className="audit-list">
                  {d.audit.map((a) => (
                    <div key={a.id}>
                      <strong>{a.action}</strong>
                      <span>{a.target_id}</span>
                      <small>
                        {new Date(a.created_at).toLocaleString("es-AR")} ·
                        Administrador: {a.actor_id ?? "Inscripción pública"}
                      </small>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
      {editing && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-title"
            className="modal-panel"
          >
            <button
              className="modal-close"
              onClick={() => setEditing(null)}
              aria-label="Cerrar editor"
            >
              <X size={22} />
            </button>
            <h2 id="edit-title">
              {editing.first_name} {editing.last_name}
            </h2>
            <p className="muted">
              Evaluación privada · {editing.age} años · {editing.phone}
            </p>
            {editing.guardian_name && (
              <p className="form-alert">
                Responsable: {editing.guardian_name} · {editing.guardian_phone}
              </p>
            )}
            <details className="personal-data-editor">
              <summary>Editar datos personales y de inscripción</summary>
              <RegistrationForm
                admin
                connected
                categories={d.categories}
                positions={d.positions}
                event={d.event}
                submitLabel="Guardar datos"
                initial={{
                  first_name: editing.first_name,
                  last_name: editing.last_name,
                  age: editing.age,
                  category_id: editing.category_id,
                  position_id: editing.position_id,
                  phone: editing.phone,
                  consent: true,
                  public_consent: editing.public_consent,
                  guardian_name: editing.guardian_name ?? "",
                  guardian_phone: editing.guardian_phone ?? "",
                  guardian_consent: editing.guardian_consent,
                }}
                onDone={async (input) => {
                  await act(
                    { type: "player.details", data: { id: editing.id, input } },
                    "Datos del jugador actualizados.",
                  );
                  setEditing(null);
                }}
              />
            </details>
            <Form
              onSubmit={async (fd) => {
                try {
                  await act({
                    type: "player.update",
                    data: {
                      id: editing.id,
                      active: checked(fd, "active"),
                      level: text(fd, "level") as "A" | "B" | "C" | "",
                      notes: text(fd, "notes"),
                      secondary_positions: fd.getAll("secondary").map(String),
                      available: checked(fd, "available"),
                      assignment_locked: checked(fd, "locked"),
                      excluded: checked(fd, "excluded"),
                      together_with: fd.getAll("together").map(String),
                      separate_from: fd.getAll("separate").map(String),
                    },
                  });
                  setEditing(null);
                } catch {}
              }}
            >
              <Field label="Nivel deportivo">
                <select name="level" defaultValue={editing.level ?? ""}>
                  <option value="">Sin evaluar</option>
                  <option value="A">A · Alto</option>
                  <option value="B">B · Intermedio</option>
                  <option value="C">C · Inicial</option>
                </select>
              </Field>
              <Field label="Posiciones alternativas (selección múltiple)">
                <select
                  name="secondary"
                  multiple
                  defaultValue={editing.secondary_positions}
                >
                  {d.positions.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Mantener junto a">
                <select
                  name="together"
                  multiple
                  defaultValue={editing.together_with}
                >
                  {d.registrations
                    .filter((r) => r.id !== editing.id)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.first_name} {r.last_name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Separar de">
                <select
                  name="separate"
                  multiple
                  defaultValue={editing.separate_from}
                >
                  {d.registrations
                    .filter((r) => r.id !== editing.id)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.first_name} {r.last_name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Observaciones privadas">
                <textarea
                  name="notes"
                  defaultValue={editing.notes}
                  maxLength={2000}
                />
              </Field>
              {[
                {
                  name: "active",
                  label: "Inscripción activa",
                  value: editing.active,
                },
                {
                  name: "available",
                  label: "Disponible para jugar",
                  value: editing.available,
                },
                {
                  name: "locked",
                  label: "Bloquear asignación actual",
                  value: editing.assignment_locked,
                },
                {
                  name: "excluded",
                  label: "Excluir de generación automática",
                  value: editing.excluded,
                },
              ].map((c) => (
                <label className="check-label" key={c.name}>
                  <input
                    name={c.name}
                    type="checkbox"
                    defaultChecked={c.value}
                  />
                  {c.label}
                </label>
              ))}
              {error && (
                <p className="form-alert error" role="alert">
                  {error}
                </p>
              )}
              <div className="modal-actions">
                <Button disabled={loading}>Guardar evaluación</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(null)}
                >
                  Cancelar
                </Button>
              </div>
            </Form>
          </section>
        </div>
      )}
      {adding && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-title"
            className="modal-panel wide"
          >
            <button
              className="modal-close"
              onClick={() => setAdding(false)}
              aria-label="Cerrar alta"
            >
              <X size={22} />
            </button>
            <h2 id="add-title">Agregar jugador</h2>
            <p className="muted">
              El pago queda pendiente. Confirmalo y evaluá al jugador antes de
              asignarlo.
            </p>
            <RegistrationForm
              categories={d.categories}
              positions={d.positions}
              event={d.event}
              connected
              admin
              onDone={async (input) => {
                await act(
                  { type: "player.create", data: input },
                  "Jugador agregado. Confirmá el pago y asigná su evaluación.",
                );
                setAdding(false);
              }}
            />
          </section>
        </div>
      )}
    </div>
  );
}
function toLocal(iso: string) {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function TournamentForm({
  settings: s,
  busy,
  eventDate,
  onSubmit,
}: {
  settings: TournamentSettings;
  busy: boolean;
  eventDate: string | null;
  onSubmit: (settings: TournamentSettings) => void;
}) {
  return (
    <Form
      onSubmit={(fd) =>
        onSubmit({
          courts: asNumber(fd, "courts"),
          start: new Date(text(fd, "start")).toISOString(),
          end: new Date(text(fd, "end")).toISOString(),
          matchMinutes: asNumber(fd, "duration"),
          restMinutes: asNumber(fd, "rest"),
          minMatches: asNumber(fd, "minimum"),
          gold: checked(fd, "gold"),
          silver: checked(fd, "silver"),
          milk: checked(fd, "milk"),
          winPoints: asNumber(fd, "win"),
          drawPoints: asNumber(fd, "draw"),
          lossPoints: asNumber(fd, "loss"),
          tiebreakers: text(fd, "ties").split(
            ",",
          ) as TournamentSettings["tiebreakers"],
          crossGroup: text(fd, "cross") as TournamentSettings["crossGroup"],
        })
      }
    >
      <div className="form-grid">
        <Field label="Inicio (hora local)">
          <input
            type="datetime-local"
            name="start"
            required
            defaultValue={eventDate ? `${eventDate}T10:00` : ""}
          />
        </Field>
        <Field label="Fin máximo (hora local)">
          <input
            type="datetime-local"
            name="end"
            required
            defaultValue={eventDate ? `${eventDate}T20:00` : ""}
          />
        </Field>
        {[
          { key: "courts", name: "Canchas", value: s.courts, min: 1, max: 8 },
          {
            key: "duration",
            name: "Minutos por partido",
            value: s.matchMinutes,
            min: 1,
            max: 60,
          },
          {
            key: "rest",
            name: "Descanso mínimo (minutos)",
            value: s.restMinutes,
            min: 0,
            max: 120,
          },
          {
            key: "minimum",
            name: "Partidos mínimos por equipo",
            value: s.minMatches,
            min: 1,
            max: 10,
          },
          {
            key: "win",
            name: "Puntos por victoria",
            value: s.winPoints,
            min: 0,
            max: 10,
          },
          {
            key: "draw",
            name: "Puntos por empate",
            value: s.drawPoints,
            min: 0,
            max: 10,
          },
          {
            key: "loss",
            name: "Puntos por derrota",
            value: s.lossPoints,
            min: 0,
            max: 10,
          },
        ].map((f) => (
          <Field label={f.name} key={f.key}>
            <input
              name={f.key}
              type="number"
              min={f.min}
              max={f.max}
              defaultValue={f.value}
              required
            />
          </Field>
        ))}
        <Field label="Desempates (último criterio: ID estable)">
          <select name="ties" defaultValue={s.tiebreakers.join(",")}>
            <option value="points,difference,for,won">
              Puntos → diferencia → tantos a favor → ganados
            </option>
            <option value="points,won,difference,for">
              Puntos → ganados → diferencia → tantos a favor
            </option>
          </select>
        </Field>
        <Field label="Comparación entre grupos">
          <select name="cross" defaultValue={s.crossGroup}>
            <option value="pointsPerGame">
              Puntos y estadísticas por partido
            </option>
            <option value="points">Totales absolutos</option>
          </select>
        </Field>
      </div>
      <div className="inline-checks">
        {[
          { key: "gold", name: "Copa de Oro" },
          { key: "silver", name: "Copa de Plata" },
          { key: "milk", name: "Copa de Leche" },
        ].map((c) => (
          <label className="check-label" key={c.key}>
            <input
              name={c.key}
              type="checkbox"
              defaultChecked={s[c.key as "gold" | "silver" | "milk"]}
            />
            {c.name}
          </label>
        ))}
      </div>
      <p className="muted">
        La propuesta calcula grupos y cruces viables. Un fixture nuevo reemplaza
        solamente el borrador anterior; no se puede regenerar un torneo
        iniciado.
      </p>
      <Button disabled={busy}>
        <Shuffle size={18} /> Generar y guardar borrador de torneo
      </Button>
    </Form>
  );
}
