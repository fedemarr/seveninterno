# Seven Interno · Antonio “Tony” Leyes · 10° aniversario

Plataforma de Los Cedros Rugby Club: inscripción pública, transferencias verificadas manualmente, evaluación privada, equipos, fixture automático, resultados y copas. Next.js App Router, React, TypeScript estricto, Tailwind, componentes con Radix/shadcn, Lucide, React Hook Form, Zod y Supabase PostgreSQL/Auth. Preparada para Vercel.

## Inicio local

```powershell
npm ci
Copy-Item .env.example .env.local
# Completar las variables de .env.local
npm run dev
```

Abrir http://localhost:3000. El repositorio nunca contiene contraseñas ni claves privadas. `.env.local`, `.vercel` y backups están ignorados. Inter se sirve localmente; no depende de Google Fonts en ejecución.

Variables:

| Variable                               | Uso                                                                 |
| -------------------------------------- | ------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL del proyecto                                                    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública publishable/anon                                      |
| `SUPABASE_SERVICE_ROLE_KEY`            | Exclusiva del servidor; RPC de inscripción y mutaciones verificadas |
| `RATE_LIMIT_SECRET`                    | Secreto aleatorio de 32 bytes o más para anonimizar IPs             |

En una instalación sin credenciales, el portal muestra estados vacíos y bloquea los envíos. Nunca simula inscripciones exitosas.

## Base de datos y autenticación

Aplicar en orden `supabase/migrations/001_platform.sql` a `008_onsite_players.sql` desde el SQL Editor de Supabase. En el proyecto configurado durante esta implementación ya se aplicaron. La primera migración es para una base vacía; las siguientes actualizan funciones y nombres de categorías sin borrar datos. `scripts/setup-db.mjs` verifica el esquema y permite aplicar las actualizaciones usando JSON en stdin oculto; no requiere guardar la contraseña PostgreSQL.

Crear usuarios en Supabase Auth y asignar su UUID en `admin_users` con rol `owner`, `organizer` o `scorer`. No existe registro público de administradores. `scripts/create-admins.mjs` permite el alta mediante la API administrativa con las credenciales en stdin. Las cuentas de Fede y Bauti ya fueron creadas en el proyecto conectado; sus contraseñas no están en estos archivos.

Los administradores se verifican con `auth.getUser()` en el servidor. Proxy renueva cookies y redirige visitantes sin sesión. Todas las API vuelven a comprobar autenticación y rol. Las mutaciones se validan con Zod, el servidor calcula las propuestas y llama a `admin_apply`, ejecutable únicamente por `service_role`. La función vuelve a comprobar al actor y bloquea la fila del evento: una versión antigua se rechaza para evitar sobreescrituras simultáneas. Los usuarios del navegador no tienen permisos directos de escritura.

RLS protege todas las tablas. El portal solo recibe `public_snapshot`, una proyección explícita que excluye teléfonos, responsables, niveles y observaciones. Los menores no aparecen por nombre. Los adultos solo aparecen con nombre e inicial de apellido si lo autorizaron. `admin_snapshot` es exclusivo de administradores. Los comprobantes se adjuntan manualmente en WhatsApp, nunca en esta plataforma.

El esquema conserva personas entre ediciones (`players`) e inscripciones específicas por evento (`registrations`). Evaluaciones, pagos, competencias, equipos, integrantes, propuestas, planes, partidos y auditoría están separados. Los grupos, reglas y referencias del cuadro se guardan como un plan JSON versionado; los partidos operativos se guardan individualmente y tienen claves foráneas de equipo. No hay dependencia de IA para los motores deportivos.

## Operación

1. Entrar en `/admin` con una cuenta autorizada.
2. En **Configuración**, completar fecha, importe, alias y titular. Avanzar de BORRADOR a INSCRIPCIONES ABIERTAS y habilitar inscripciones.
3. Compartir `/inscripcion`. La inscripción queda en PENDIENTE PAGO. El jugador transfiere y manda su comprobante a Fede o Bauti por WhatsApp.
4. Confirmar o rechazar el pago en **Pagos**. No se confirma al abrir WhatsApp. Una reversión exige quitar previamente al jugador del plantel.
5. En **Evaluaciones**, asignar nivel A/B/C y, si corresponde, posiciones alternativas, bloqueos y restricciones privadas. Se pueden editar los datos y dar de baja inscripciones.
6. Este Seven reúne todas las categorías, desde M14 hasta Veteranos, en una única competencia **Seven Interno**. La mezcla de menores y adultos está expresamente autorizada por el organizador y queda registrada en la configuración. Los equipos se equilibran por A/B/C, posiciones, cantidad y edades. Se conserva la autorización del responsable para inscribir menores.
7. En **Generador de equipos** aparecen directamente Equipo 1, Equipo 2, etc., con sus jugadores. Al confirmar un pago se actualizan los planteles y se crean equipos adicionales cuando alcanza la cantidad. A/B/C, edad y posición equilibran los borradores; sin evaluación se usa B provisional, sin inventar una evaluación guardada. Los equipos existentes conservan sus IDs y nombres. Podés arrastrar jugadores por el agarre de puntos, o usar ↔ con teclado o celular para moverlos a otro equipo. El movimiento manual queda fijado para que el automático lo respete. Desde **Agregar jugador** o el botón de cada equipo se completa un alta presencial, pago opcional confirmado, A/B/C y destino. Un alta sin pago queda pendiente; un alta con pago se asigna automáticamente o al equipo elegido, dentro de una sola transacción. Los ajustes permiten cambiar tamaño y capacidad o pausar el automático. Publicar requiere una acción aparte.
8. Cuando existe un fixture o planteles publicados, los nuevos confirmados se agregan automáticamente a un destino compatible con capacidad, nivel y restricciones. Nunca se redistribuyen los integrantes anteriores ni se modifica el fixture. Si no hay lugar o una restricción lo impide, el pago se guarda y se muestra que la asignación necesita revisión. Confirmación y asignación válida se guardan bajo la misma transacción y versión; cualquier fallo de integridad revierte ambas. `scripts/test-automatic-db.mjs` verifica esta atomicidad, auditoría, protección de planteles publicados y concurrencia, revirtiendo todos sus cambios de prueba.
9. Generar un torneo con horarios, canchas, minutos, descanso, mínimo de partidos y copas deseadas. Revisar advertencias, horarios y reglas. El fixture queda en borrador hasta **Aprobar y publicar**. Para competencias diferentes, reservar franjas sin colisiones; el servidor rechaza canchas superpuestas.
10. Avanzar el evento por EQUIPOS PUBLICADOS → TORNEO CONFIGURADO → TORNEO EN CURSO. En **Modo Torneo**, iniciar, cargar marcador, definir un ganador manual del desempate en copas y reprogramar con detección de conflictos. Al completar grupos se resuelven plazas automáticamente; también existe confirmación de clasificados. Corregir resultados que afectan cruces requiere autorizar la anulación de sus resultados dependientes.
11. Al finalizar todos los partidos, pasar a TORNEO FINALIZADO. El owner puede crear la próxima edición sin borrar identidades ni el historial anterior. La interfaz operativa muestra la edición activa; el historial permanece en la base.

## Reglas deportivas implementadas

- Balanceo determinista por semilla, nivel, cantidad, edades y distribución forward/back; considera posiciones alternativas para advertir sobre medios. Distribuye menores y adultos entre equipos para evitar concentraciones por edad. Respeta elegibilidad, pago, disponibilidad, exclusión, juntos/separados y bloqueos. Las advertencias y el puntaje permiten revisar una propuesta imperfecta. Las restricciones imposibles se rechazan.
- Formatos para 4–24 equipos, incluidos impares. Evalúa tamaños de grupos y genera todos contra todos sin duplicados mediante rotación. Se puede exigir un mínimo de partidos de grupos, aparte del mínimo total. Para la prueba de 12 equipos se exigen 3 partidos de grupos: genera tres zonas de cuatro, y Oro/Plata/Leche con cuatro clasificados cada una, semifinales y final. Las copas tienen al menos dos participantes; usa pases directos por clasificación cuando el cuadro no es potencia de dos.
- Distribución entre copas por posición en el grupo y luego comparación determinista entre grupos, con totales o estadísticas por partido. Desempates configurables por puntos, diferencia, tantos a favor y victorias, con UUID estable como último criterio. Las reglas se muestran en la configuración y se conservan en cada plan.
- Planificación de canchas y descansos, incluso sobre rutas futuras del cuadro. Un horario inviable devuelve alternativas, no un fixture incompleto. Las copas esperan al cierre de grupos. No se regenera un torneo iniciado.
- Las correcciones conservan la identidad de los equipos; las referencias y los resultados no dependen del nombre. El detalle anterior y la operación quedan en auditoría.

## API

| Método y ruta           | Función                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| `POST /api/inscripcion` | Validar y guardar inscripción; devolver datos de transferencia        |
| `POST /api/auth`        | Iniciar sesión Supabase y verificar rol                               |
| `DELETE /api/auth`      | Cerrar sesión                                                         |
| `POST /api/admin`       | Comando tipado + versión del evento; operación transaccional auditada |

Los comandos se definen en `src/lib/commands.ts`. Todas las mutaciones exigen origen coincidente. Inscripciones tienen límite durable de ocho intentos por ventana de 15 minutos por hash de IP confiable de Vercel, además de campo antispam y prevención de duplicados por nombre y teléfono normalizados. Supabase Auth aplica sus límites de login. No se guardan IPs en claro.

El portal consulta al servidor cada 20 segundos cuando está visible. Se eligió polling para publicar solo proyecciones autorizadas, evitando suscripciones públicas a tablas privadas.

## Validación

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

`tests/` cubre edades, menores, consentimiento, restricciones, balance, reproducibilidad, altas tardías, formatos de 4 a 24 equipos, clasificación, pases, descansos, colisiones, puntos y correcciones. `scripts/test-database.mjs` verifica pagos, duplicados, elegibilidad, IDs estables, auditoría, RLS y permisos contra PostgreSQL dentro de una transacción que SIEMPRE revierte. `scripts/test-http.mjs` verifica rutas públicas, login real, todas las pantallas administrativas, protección de origen y cierre de inscripción. Recibe el login en stdin y nunca lo imprime; admite `SEVEN_TEST_URL` para probar producción. GitHub Actions ejecuta lint, TypeScript, unitarias y build sin credenciales.

La revisión visual automatizada en navegador no pudo ejecutarse en el entorno de implementación. Se verificaron respuestas HTTP y compilación, pero no se afirma una prueba visual de escritorio o celular. Revisar especialmente reproducción de video y formularios en un celular real antes de difundir el enlace.

La prueba solicitada por el organizador usa **144 jugadores ficticios, 12 equipos de 12, tres zonas de cuatro y tres copas de cuatro equipos**. Cada equipo juega tres partidos de grupos. Oro recibe a los tres primeros y el mejor segundo; Plata recibe a los siguientes cuatro; Leche, a los cuatro restantes. Cada copa tiene dos semifinales y una final. El fixture se guarda en borrador: no se inventan resultados ni clasificados. `scripts/seed-tournament-demo.mjs` prepara participantes marcados como PRUEBA sin tocar equipos publicados ni fixtures existentes; necesita conexión por stdin oculto. `scripts/test-onsite-db.mjs` verifica que el alta presencial, pago opcional, evaluación y destino se guarden de manera atómica y revierte todas las pruebas.

## Vercel

El proyecto usa Node 24 y región São Paulo (`gru1`). Cargar las cuatro variables indicadas para producción y previews; la clave de servicio nunca lleva prefijo NEXT_PUBLIC. El helper `scripts/configure-vercel.mjs` las envía al CLI mediante stdin. `vercel --prod` publica la aplicación. Vincular el repositorio para despliegues futuros. No subir `.env.local` ni la contraseña de PostgreSQL.

## Respaldo y recuperación

Antes del torneo, revisar backups de Supabase en el dashboard y la disponibilidad de recuperación puntual del plan contratado. Se puede hacer un dump cifrado fuera del repositorio con las herramientas oficiales de PostgreSQL (`pg_dump`), incluyendo los esquemas necesarios para conservar las referencias de Auth. Guardar la conexión en una variable de entorno temporal; no incluirla en comandos compartidos. Probar una restauración en otro proyecto antes de depender del backup. Ningún script de esta entrega elimina datos operativos ni activa backups pagos automáticamente.

## Pendientes de organización y mejoras sugeridas

- Completar fecha e importe y revisar elegibilidad, consentimiento y reglas antes de abrir inscripciones.
- Probar el recorrido con Fede y Bauti en un celular real; revisar tiempos y canchas de cada propuesta antes de publicarla.
- Definir retención de datos y ejecutar el procedimiento de backup previo al evento.
- Como mejoras visuales futuras: escudos propios por equipo y fotos autorizadas para cada edición.
- Como interacción adicional: pantalla de cancha a pantalla completa para resultados en vivo.
