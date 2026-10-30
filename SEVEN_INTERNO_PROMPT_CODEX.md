# 🏉 SEVEN INTERNO — Prompt maestro final para Codex

## Rol y objetivo

Actuá como un equipo de desarrollo de software senior, integrado por arquitectura de software, desarrollo full-stack, ingeniería de bases de datos, UX/UI, testing y seguridad.

Tu misión es **diseñar e implementar una plataforma web completa llamada SEVEN INTERNO**, destinada a organizar un torneo interno de Rugby Seven de un club argentino.

No quiero una landing sin funcionalidad ni un prototipo con botones simulados. Quiero una aplicación real, segura, responsive y reutilizable para futuras ediciones.

### Flujo general

1. Inscripción de jugadores mediante enlace público.
2. Transferencia bancaria y envío manual del comprobante por WhatsApp.
3. Confirmación manual del pago por un administrador.
4. Evaluación privada del nivel deportivo del jugador.
5. Generación de equipos equilibrados por nivel y posición.
6. Modificación manual de planteles y nombres de equipos.
7. Altas de jugadores incluso el día del Seven.
8. Diseño automático del formato del torneo en función de los equipos confirmados.
9. Fixture, fase de grupos, Copa de Oro, Copa de Plata y Copa de Leche cuando sean viables.
10. Carga de resultados, clasificaciones y cruces automáticos.
11. Portal público de seguimiento del torneo.

---

## 1. Stack tecnológico

- **Frontend:** Next.js (App Router), React, TypeScript estricto, Tailwind CSS, shadcn/ui, Lucide React.
- **Formularios y validación:** React Hook Form y Zod.
- **Backend:** Next.js Server Actions y/o Route Handlers según convenga.
- **Base de datos:** Supabase PostgreSQL.
- **Autenticación:** Supabase Auth para administradores.
- **Tiempo real:** Supabase Realtime para resultados y estados cuando aporte valor.
- **Hosting:** Vercel.
- **Calidad:** ESLint, pruebas unitarias y de integración, auditoría, validación del servidor y Row Level Security.

Inspeccioná el repositorio antes de implementar; reutilizá lo que exista y no sobrescribas trabajo del usuario sin justificación.

## 2. Identidad y experiencia visual

- Estilo deportivo, moderno y profesional.
- Paleta inicial azul, negro y blanco, configurable.
- Diseño responsive con foco en celular para jugadores y computadora para organizadores.
- Tableros, tarjetas de equipos, tablas de posiciones, cuadros eliminatorios y estados claros.
- Dos experiencias diferenciadas: **portal público** y **portal administrador**.
- Evitar pantallas bonitas sin funciones reales.

## 3. Categorías

Las únicas categorías de inscripción iniciales son:

1. Plantel Superior
2. Padres
3. Veteranos
4. M14
5. M15
6. M16
7. M17
8. M19

**No incluir** Primera, Intermedia ni Preintermedia. Plantel Superior es una categoría única.

Almacenar categorías en una tabla configurable. Diferenciar **categoría de inscripción** de **nivel deportivo privado A/B/C**.

No mezclar automáticamente menores con adultos. Implementar reglas configurables de elegibilidad, comprobaciones de edad y autorización de responsable cuando corresponda. Permitir competencias separadas o agrupaciones autorizadas por organizadores.

## 4. Posiciones específicas

El formulario permite seleccionar una posición principal.

### Forwards
- Pilar izquierdo
- Pilar derecho
- Hooker
- Segunda línea
- Tercera línea / Ala
- Octavo

### Backs
- Medio scrum
- Apertura
- Primer centro
- Segundo centro
- Wing
- Fullback

Cada posición tiene grupo `forward` o `back`. Desde el panel privado se pueden agregar posiciones secundarias.

Las posiciones son las habituales de rugby, pero el algoritmo debe adaptarlas a **Rugby Seven**, sin exigir una formación de quince jugadores.

## 5. Inscripción pública

Ruta: `/inscripcion`.

Campos:

- Nombre
- Apellido
- **Edad (número entero; no solicitar fecha de nacimiento)**
- Categoría
- Posición principal específica
- Teléfono de contacto
- Aceptación de condiciones y tratamiento de datos
- Autorización/datos de responsable si corresponde para menores

**No solicitar nivel deportivo ni adjuntar comprobantes.**

Al enviar:

1. Validar datos en cliente y servidor; prevenir duplicados razonablemente.
2. Guardar jugador e inscripción en Supabase.
3. Crear inscripción con estado `PENDIENTE_PAGO`.
4. Mostrar importe, alias, instrucciones y contactos de WhatsApp.
5. No incluir al jugador entre los habilitados para equipos hasta confirmar el pago.

## 6. Pagos mediante transferencia y WhatsApp

El administrador configura importe, alias, titular, CBU/CVU opcional e instrucciones.

Después del formulario mostrar:

> ¡Tu inscripción fue recibida! Transferí el importe al alias indicado y enviá el comprobante por WhatsApp a uno de los organizadores. La participación queda pendiente hasta la confirmación.

Contactos:

- **Fede:** 11 2705-6803 — https://wa.me/5491127056803
- **Bauti:** 11 3120-2929 — https://wa.me/5491131202929

Dos botones con mensaje predefinido, incluyendo datos del formulario:

> Hola, soy [NOMBRE Y APELLIDO]. Me inscribí al Seven Interno en la categoría [CATEGORÍA]. Te envío mi comprobante de pago.

El jugador **adjunta el comprobante manualmente en WhatsApp**. No crear subida de archivos ni integrar WhatsApp Business API en la primera versión. No afirmar que abrir WhatsApp confirma el pago.

Estados sugeridos: `PENDIENTE_PAGO`, `PAGO_EN_REVISION`, `PAGO_CONFIRMADO`, `PAGO_RECHAZADO`.

Solo un administrador confirma o revierte pagos y cada modificación queda auditada.

## 7. Dashboard administrativo

Ruta protegida `/admin`, autenticación con Supabase Auth y permisos por rol.

Indicadores:

- Inscriptos totales
- Pendientes y confirmados
- Jugadores sin evaluación
- Jugadores sin equipo
- Equipos y competencias
- Recaudación registrada
- Estado del torneo y próximos partidos

Acciones:

- Buscar, filtrar y editar jugadores
- Confirmar/rechazar pagos
- Evaluar nivel deportivo
- Definir posiciones alternativas
- Agregar y dar de baja jugadores
- Consultar equipos y torneos
- Registrar observaciones privadas

Guardar quién hizo cada operación y cuándo.

## 8. Evaluación privada

Evaluación asignada **solo por administradores**:

- **A:** nivel alto
- **B:** nivel intermedio
- **C:** nivel inicial

No preguntarla en el formulario ni exhibirla en pantallas públicas. Permitir dejarla sin definir, pero advertir al generar equipos.

Guardar observaciones privadas, disponibilidad, posiciones alternativas y restricciones de asignación.

## 9. Motor de armado equilibrado de equipos

Implementar un algoritmo independiente, reproducible, testeable y configurable, sin dependencia de un modelo de IA externo.

Entradas:

- Jugadores con pago confirmado
- Elegibilidad por categoría/competencia
- Evaluaciones A/B/C
- Posiciones y versatilidad
- Cantidad de jugadores por equipo
- Suplentes
- Número de equipos: automático o especificado
- Restricciones de inclusión, exclusión, mantener juntos/separados y jugadores bloqueados

Objetivos:

- Distribuir el nivel deportivo de forma pareja.
- Repartir forwards y backs y cubrir roles importantes de Seven.
- Minimizar diferencias en cantidad de jugadores.
- Respetar categorías y restricciones obligatorias.
- Calcular un puntaje de balance y advertir si una solución no es ideal.

Funciones:

- Generar propuesta
- Recalcular
- Comparar distribuciones
- Mostrar razones y métricas de balance
- Guardar borrador
- Confirmar y publicar

**Regla crítica:** la llegada de un nuevo pago puede actualizar una *propuesta*, pero jamás modificar automáticamente un plantel ya publicado.

## 10. Equipos y nombres editables

Los equipos se crean con nombres genéricos: `Equipo 1`, `Equipo 2`, etc.

Los jugadores eligen su nombre durante el certamen y el administrador lo actualiza en cualquier momento. Opcionalmente, puede modificar color y escudo.

La identidad del equipo es un **ID estable**, nunca el nombre. Renombrar debe reflejarse en fixture, tablas, partidos, resultados, copas y portal público sin alterar el historial.

## 11. Editor manual de planteles

Ruta `/admin/equipos`.

Permitir:

- Renombrar equipo
- Agregar, quitar y mover jugadores
- Intercambiar integrantes entre equipos
- Cambiar capitán y suplentes
- Bloquear posiciones/asignaciones
- Consultar composición por posiciones y métricas privadas de nivel
- Guardar, cancelar y auditar cambios

Preferir drag & drop con alternativa accesible mediante botones.

## 12. Inscripciones tardías el día del Seven

Botón administrativo `+ Agregar jugador`.

El administrador carga datos, confirma pago, asigna nivel y elige un equipo manualmente o solicita sugerencia automática.

Si el torneo ya comenzó:

- **No** rehacer automáticamente todos los equipos.
- Sugerir destinos según cantidad, nivel, roles y restricciones.
- Exigir aprobación administrativa.
- Registrar cambios y advertir efectos sobre reglas de participación.
- Preservar partidos ya disputados y resultados históricos.

Permitir inscripciones públicas tardías solo si el organizador las habilita.

## 13. Motor automático de formato de torneo

Crear módulo independiente `TournamentFormatEngine`.

**El organizador no debería tener que calcular manualmente cuántos grupos crear ni cómo armar los cruces.**

Entradas:

- Número real de equipos por competencia
- Cantidad de canchas
- Horario de inicio y finalización
- Minutos de partido
- Descanso mínimo
- Cantidad mínima deseada de partidos por equipo
- Preferencia por las copas Oro, Plata y Leche
- Reglas de puntuación y desempates

Al pulsar **Generar torneo automáticamente**:

1. Contar equipos elegibles.
2. Evaluar formatos viables (también con números impares).
3. Determinar cantidad y tamaño de grupos.
4. Distribuir equipos sin duplicaciones.
5. Generar todos los encuentros de grupos.
6. Definir criterios de clasificación y cupos por copa.
7. Generar los cuadros de eliminación que correspondan.
8. Planificar horarios y canchas sin superposiciones.
9. Estimar duración del evento.
10. Presentar vista previa y advertencias para aprobación.

Ejemplos **orientativos, no rígidos**: 4 equipos → un grupo; 8 → dos grupos de cuatro; 12 → tres grupos de cuatro; 16 → cuatro grupos de cuatro. Decidir según restricciones reales.

No crear copas vacías ni cruces matemáticamente imposibles. Si no es razonable disputar tres copas, sugerir una alternativa viable y explicar por qué. Generar bye/pases directos solo cuando corresponda.

Si no existe planificación posible dentro del horario disponible, mostrar el conflicto y alternativas de ajuste, nunca fingir que cabe.

No publicar una estructura sin confirmación administrativa.

## 14. Fase de grupos

Generar encuentros y tablas de clasificación:

- PJ, PG, PE, PP
- PF, PC, DIF
- PTS

Puntuación, desempates y comparaciones entre grupos de tamaños diferentes **configurables y deterministas**.

Actualizar posiciones a medida que se confirman resultados. No duplicar enfrentamientos en una fase todos-contra-todos.

## 15. Copas Oro, Plata y Leche

Tras grupos, clasificar equipos según las reglas generadas y confirmadas.

Admitir cuartos, semifinales, finales, partidos de clasificación y pases directos. Mostrar cuadros visuales con plazas futuras como `Ganador semifinal 1`, sin inventar clasificados antes de tiempo.

Al confirmar un resultado, avanzar el ganador según el cuadro; resolver empates con reglas configurables. Detectar consecuencias de correcciones retroactivas y exigir confirmación antes de modificar fases dependientes.

## 16. Fixture y canchas

Cada partido debe tener:

- ID y número visible
- Etapa y grupo/copa
- Equipo A y B o plazas por definir
- Fecha y hora
- Cancha
- Estado
- Resultado

Evitar:

- Un equipo en partidos simultáneos
- Dos partidos en una misma cancha a la vez
- Descansos inferiores al mínimo configurado
- Cruces inválidos o repetidos innecesariamente

Permitir edición administrativa de horario y cancha con detección de conflictos.

## 17. Modo Torneo

Ruta `/admin/torneo`, optimizada para computadora.

Mostrar partidas actuales, siguientes, resultados, grupos, tablas, cupos, eliminatorias, horas y canchas.

Acciones rápidas:

- Iniciar/finalizar partido
- Cargar marcador
- Corregir marcador
- Reprogramar
- Cambiar cancha
- Confirmar clasificados
- Publicar siguiente fase

Todas las acciones persisten de verdad; proteger modificaciones simultáneas y auditar correcciones.

## 18. Portal público

Secciones:

- Inicio
- Equipos y planteles autorizados
- Fixture
- Próximos partidos
- Resultados
- Grupos y posiciones
- Copa de Oro
- Copa de Plata
- Copa de Leche
- Campeones

Actualizaciones en tiempo real cuando sea posible.

**Nunca exponer** niveles A/B/C, observaciones, teléfonos, datos de responsables ni información privada de menores. Publicar únicamente los datos autorizados.

## 19. Base de datos

Diseñar esquema normalizado y documentado. Tablas orientativas:

- `events`
- `categories`
- `competitions`
- `players`
- `registrations`
- `positions`
- `player_positions`
- `player_evaluations`
- `payment_records`
- `teams`
- `team_members`
- `team_generation_runs`
- `team_generation_assignments`
- `tournament_settings`
- `tournament_stages`
- `tournament_groups`
- `tournament_group_members`
- `matches`
- `match_results`
- `bracket_slots`
- `admin_users`
- `audit_logs`

Ajustar según mejores criterios de arquitectura. Usar claves foráneas, índices, restricciones, RLS, transacciones en operaciones críticas y separación estricta de datos públicos/privados.

Una persona debe poder participar en ediciones futuras sin duplicar innecesariamente su identidad.

## 20. Estados del evento

1. `BORRADOR`
2. `INSCRIPCIONES_ABIERTAS`
3. `PREPARACION_EQUIPOS`
4. `EQUIPOS_PUBLICADOS`
5. `TORNEO_CONFIGURADO`
6. `TORNEO_EN_CURSO`
7. `TORNEO_FINALIZADO`

Permitir transiciones validadas y operaciones controladas según etapa. Después del inicio, no recalcular grupos ni eliminatorias sin intervención explícita.

## 21. Seguridad y privacidad

- Login para admins y roles.
- Autorización real del servidor.
- RLS y protección de tablas privadas.
- Zod y validaciones del servidor.
- Prevención de abuso/spam y duplicados.
- Variables de entorno, sin secretos en navegador.
- Auditoría de pagos, equipos y resultados.
- Controles de concurrencia y confirmación de cambios de alto impacto.
- Respaldos y recuperación.
- Protección especial de datos de menores y consentimiento del responsable cuando corresponda.

## 22. Testing obligatorio

Cubrir con pruebas automatizadas:

1. Inscripción y validación de edad/categoría.
2. Duplicados y estados de pago.
3. Confirmación manual de pago.
4. Evaluaciones privadas y permisos.
5. Balance de equipos, restricciones y cantidades impares.
6. Renombrado sin pérdida de historial.
7. Altas tardías sin reorganización automática.
8. Formatos de torneo con 4 a 24 equipos, incluidos números impares.
9. Fixture sin colisiones de cancha, equipo ni descanso.
10. Posiciones y desempates.
11. Clasificación a copas y pases directos.
12. Avance de ganadores y corrección de resultados.
13. Protección de datos privados y operaciones simultáneas.

Cuando un formato sea inviable, devolver errores y sugerencias comprensibles en vez de generar un fixture corrupto.

## 23. Menú de administración

- Dashboard
- Inscripciones
- Pagos
- Jugadores
- Evaluaciones
- Equipos
- Generador de equipos
- Configuración del torneo
- Fixture
- Modo Torneo
- Resultados
- Copas
- Configuración

Agregar búsqueda, filtros, estados vacíos, mensajes de confirmación y manejo de errores.

## 24. Fases de implementación

### Fase 1 — Base
Arquitectura, proyecto, layouts, Supabase, migraciones y autenticación.

### Fase 2 — Inscripciones y pagos
Formulario público, categorías, posiciones, estado pendiente, alias y enlaces WhatsApp.

### Fase 3 — Administración
Dashboard, gestión de jugadores, confirmación de pago y evaluación privada.

### Fase 4 — Equipos
Algoritmo de balanceo, propuestas, editor manual, nombres editables y altas tardías.

### Fase 5 — Torneo automático
Selección de formato, grupos, fixture, horarios y planificación de copas.

### Fase 6 — Competencia
Resultados, tablas, cruces, avances y Modo Torneo.

### Fase 7 — Portal público
Equipos, fixture, resultados y campeones.

### Fase 8 — Calidad y despliegue
Testing, seguridad, optimización, documentación y Vercel.

## 25. Instrucciones de ejecución para Codex

1. **Inspeccioná el repositorio actual.** No sobreescribas trabajo existente sin analizarlo.
2. Presentá una arquitectura coherente, modelo de datos y plan de trabajo.
3. Empezá a implementar la **Fase 1** en el mismo repositorio.
4. Continuá con las siguientes fases cuando el entorno lo permita, verificando dependencias y priorizando funcionalidad real.
5. Mantené el proyecto compilable; ejecutá pruebas tras cada fase.
6. Si faltan credenciales, dejá integraciones preparadas y `.env.example` sin inventar secretos.
7. Documentá archivos modificados, migraciones, comandos, pruebas, lo que funciona y lo pendiente.
8. Usá configuraciones editables para reglas deportivas no definidas todavía (cantidad de jugadores, suplentes, canchas, horarios, etc.). No inventes reglas definitivas.
9. No publiqués planteles ni fixtures sin confirmación del administrador.
10. No te detengas en una maqueta ni solo en un plan: implementá código real con persistencia y permisos.

**Objetivo final:** Fede y Bauti deben poder operar desde una única plataforma un Seven Interno completo, con inscripción sencilla, pagos verificados por WhatsApp, equipos equilibrados y editables, participantes de último momento, formato competitivo automático y resultados actualizados; todo listo para reutilizar en nuevas ediciones.
