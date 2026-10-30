"use client";
import { useId, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { ArrowRightLeft, GripVertical, LockKeyhole, Plus } from "lucide-react";
import type { AdminSnapshot } from "@/lib/data";
import type { Registration, Team } from "@/lib/domain";
import { Button } from "./ui/button";

export function RosterBoard({
  data,
  teams,
  busy,
  onMove,
  onAdd,
}: {
  data: AdminSnapshot;
  teams: Team[];
  busy: boolean;
  onMove: (playerId: string, teamId: string) => Promise<void>;
  onAdd: (teamId: string) => void;
}) {
  const id = useId(),
    [active, setActive] = useState<string | null>(null),
    [moving, setMoving] = useState(false),
    [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(
      null,
    );
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
  );
  const disabled = busy || moving || data.role === "scorer";
  async function move(playerId: string, teamId: string) {
    const current = data.members.find((m) => m.registration_id === playerId);
    if (!current || current.team_id === teamId || disabled) return;
    setMoving(true);
    setFeedback(null);
    try {
      await onMove(playerId, teamId);
      setFeedback({
        text: "Movimiento guardado. El automático va a respetar este equipo.",
        error: false,
      });
    } catch (error) {
      setFeedback({
        text:
          error instanceof Error
            ? error.message
            : "No se pudo mover al jugador.",
        error: true,
      });
    } finally {
      setMoving(false);
    }
  }
  const dragged = data.registrations.find((p) => p.id === active);
  return (
    <div className="roster-board">
      <p className="roster-help">
        Arrastrá un jugador al equipo de destino o usá el botón ↔. Los
        movimientos manuales quedan fijados.
      </p>
      {feedback && (
        <p
          className={`roster-feedback ${feedback.error ? "error" : "success"}`}
          role={feedback.error ? "alert" : "status"}
        >
          {feedback.text}
        </p>
      )}
      <DndContext
        id={id}
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={(event) => {
          setActive(String(event.active.id));
          setFeedback(null);
        }}
        onDragCancel={() => setActive(null)}
        onDragEnd={(event) => {
          setActive(null);
          if (event.over)
            void move(String(event.active.id), String(event.over.id));
        }}
      >
        <div className="teams-grid automatic-team-grid">
          {teams.map((team) => (
            <TeamDropCard
              key={team.id}
              team={team}
              data={data}
              teams={teams}
              disabled={disabled}
              onMove={move}
              onAdd={onAdd}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {dragged && (
            <div className="roster-drag-preview">
              <GripVertical size={18} />
              <strong>
                {dragged.first_name} {dragged.last_name}
              </strong>
              <b className={`level level-${dragged.level ?? "none"}`}>
                {dragged.level ?? "B*"}
              </b>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
function TeamDropCard({
  team,
  data,
  teams,
  disabled,
  onMove,
  onAdd,
}: {
  team: Team;
  data: AdminSnapshot;
  teams: Team[];
  disabled: boolean;
  onMove: (playerId: string, teamId: string) => Promise<void>;
  onAdd: (teamId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: team.id, disabled });
  const members = data.members.filter((m) => m.team_id === team.id),
    players = members
      .map((m) => data.registrations.find((p) => p.id === m.registration_id))
      .filter((p) => p !== undefined);
  return (
    <section
      ref={setNodeRef}
      className={`admin-card automatic-team-card roster-drop-card ${isOver ? "is-over" : ""}`}
      aria-label={`Plantel de ${team.name}`}
    >
      <div className="automatic-team-title">
        <h2>{team.name}</h2>
        <span>{players.length} jugadores</span>
      </div>
      <small className="automatic-team-state">
        {team.published
          ? "Publicado"
          : players.length < 7
            ? `En formación · faltan ${7 - players.length} para completar 7`
            : "Borrador listo"}
      </small>
      <ul>
        {players.map((player) => (
          <PlayerRow
            key={player.id}
            player={player}
            team={team}
            teams={teams}
            locked={Boolean(
              members.find((m) => m.registration_id === player.id)?.locked ||
              player.assignment_locked,
            )}
            disabled={disabled}
            onMove={onMove}
          />
        ))}
      </ul>
      {!players.length && (
        <p className="roster-empty-drop">
          Soltá un jugador acá para incorporarlo.
        </p>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="roster-add-player"
        disabled={disabled}
        onClick={() => onAdd(team.id)}
      >
        <Plus size={16} />
        Agregar jugador a este equipo
      </Button>
    </section>
  );
}
function PlayerRow({
  player,
  team,
  teams,
  locked,
  disabled,
  onMove,
}: {
  player: Registration;
  team: Team;
  teams: Team[];
  locked: boolean;
  disabled: boolean;
  onMove: (playerId: string, teamId: string) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } =
    useDraggable({ id: player.id, disabled });
  return (
    <li
      ref={setNodeRef}
      className={`roster-player ${isDragging ? "is-dragging" : ""}`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="roster-drag-handle"
        {...attributes}
        {...listeners}
        aria-label={`Arrastrar a ${player.first_name} ${player.last_name}`}
        disabled={disabled}
      >
        <GripVertical size={18} />
      </button>
      <span className="roster-player-name">
        {player.first_name} {player.last_name}
        {locked && (
          <small className="roster-fixed">
            <LockKeyhole size={10} />
            Fijado
          </small>
        )}
      </span>
      <b className={`level level-${player.level ?? "none"}`}>
        {player.level ?? "B*"}
      </b>
      <details className="roster-move-menu">
        <summary
          aria-label={`Mover a ${player.first_name} ${player.last_name} a otro equipo`}
        >
          <ArrowRightLeft size={15} />
        </summary>
        <div>
          {teams
            .filter((t) => t.id !== team.id)
            .map((target) => (
              <button
                key={target.id}
                type="button"
                disabled={disabled}
                onClick={() => void onMove(player.id, target.id)}
              >
                {target.name}
              </button>
            ))}
        </div>
      </details>
    </li>
  );
}
