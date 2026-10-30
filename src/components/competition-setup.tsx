"use client";
import type { Category, Competition, Registration } from "@/lib/domain";
import {
  competitionPresets,
  type CompetitionPreset,
} from "@/lib/competition-setup";
import { Button } from "./ui/button";
import { Plus } from "lucide-react";

export function CompetitionSetup({
  categories,
  competitions,
  players,
  busy,
  onCreate,
}: {
  categories: Category[];
  competitions: Competition[];
  players: Registration[];
  busy: boolean;
  onCreate: (preset: CompetitionPreset) => void;
}) {
  const presets = competitionPresets(categories).filter(
    (p) =>
      !competitions.some(
        (c) =>
          c.min_age === p.min_age &&
          c.max_age === p.max_age &&
          c.category_ids.length === p.category_ids.length &&
          c.category_ids.every((id) => p.category_ids.includes(id)),
      ),
  );
  return (
    <div className="competition-quick-setup">
      <h3>Elegí quiénes van a jugar</h3>
      <p>
        Creá el grupo con un toque. Los menores y los adultos se organizan por
        separado.
      </p>
      <div className="competition-presets">
        {presets.map((preset) => {
          const count = players.filter(
            (p) =>
              p.active &&
              preset.category_ids.includes(p.category_id) &&
              p.age >= preset.min_age &&
              p.age <= preset.max_age &&
              p.payment_status === "PAGO_CONFIRMADO" &&
              p.available &&
              !p.excluded,
          ).length;
          return (
            <Button
              key={preset.name}
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onCreate(preset)}
            >
              <Plus size={16} />
              <span>
                {preset.name}
                <small>{count} con pago confirmado</small>
              </span>
            </Button>
          );
        })}
      </div>
      {!presets.length && (
        <p>
          Los grupos disponibles ya están creados. Podés elegirlos en la lista.
        </p>
      )}
    </div>
  );
}
