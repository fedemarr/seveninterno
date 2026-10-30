export function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const known: Record<string, string> = {
    SETUP_REQUIRED:
      "La conexión con Supabase todavía no está configurada. No se guardaron datos.",
    UNAUTHORIZED: "Iniciá sesión para continuar.",
    FORBIDDEN: "Tu usuario no tiene permiso para esta acción.",
    STALE_VERSION:
      "Otro administrador modificó los datos. Recargá la página antes de continuar.",
    REGISTRATION_CLOSED: "Las inscripciones no están abiertas en este momento.",
    DUPLICATE:
      "Ya recibimos una inscripción con estos datos. Consultá a los organizadores.",
    RATE_LIMIT:
      "Recibimos varios intentos. Esperá 15 minutos y volvé a probar.",
    CATEGORY_AGE: "La edad no corresponde a la categoría seleccionada.",
    REMOVE_FROM_TEAM_FIRST:
      "Quitá al jugador de su equipo antes de darlo de baja o revertir el pago.",
    TEAMS_ALREADY_EXIST:
      "Esta competencia ya tiene equipos. Usá el editor manual para conservar sus identidades.",
    TOURNAMENT_STARTED:
      "El torneo ya comenzó: conservá su estructura y editá solo partidos o planteles puntuales.",
    ASSIGNMENT_LOCKED:
      "La asignación está bloqueada. Confirmá expresamente el desbloqueo.",
    INELIGIBLE_PLAYER: "El jugador no está habilitado para este equipo.",
    INVALID_TRANSITION: "El estado del evento debe avanzar de a una etapa.",
    PUBLISH_TEAMS_FIRST: "Primero confirmá y publicá los equipos.",
    PUBLISH_TOURNAMENT_FIRST: "Primero publicá el fixture.",
    UNFINISHED_MATCHES: "Todavía hay partidos sin finalizar.",
  };
  for (const [key, value] of Object.entries(known))
    if (message.includes(key)) return value;
  if (message.includes("duplicate key"))
    return "Estos datos ya existen. Revisá la inscripción o el equipo.";
  if (
    message.includes("constraint") ||
    message.includes("invalid input") ||
    message.includes("violates")
  )
    return "Los datos no cumplen las reglas configuradas. Revisá la operación.";
  return message.length < 250 && !message.includes("SQL")
    ? message
    : "No se pudo completar la operación. Los cambios no se guardaron.";
}
