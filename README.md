# Porra Ezpeleta

Aplicacion React para gestionar porras familiares de Mundiales y Eurocopas. Incluye acceso por codigo de correo, una porra por participante, cuadro eliminatorio encadenado, Bota de Oro, clasificacion automatica y panel de administracion.

## Desarrollo local

```bash
npm install
npm run dev
```

Sin las claves de Supabase la portada funciona en modo preparacion, mostrando a Jaime como campeon vigente. No se crean usuarios ni porras de muestra.

## Preparar Supabase

1. Crea un proyecto gratuito en Supabase.
2. Abre el editor SQL y ejecuta `supabase/migrations/202607210001_initial_schema.sql`.
3. Copia `.env.example` como `.env.local` y rellena la URL y la clave publica `anon` del proyecto.
4. Instala Supabase CLI, vincula el proyecto y publica la funcion:

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase functions deploy request-login --no-verify-jwt
```

La migracion crea la competicion inicial, pone la portada en modo ganador con Jaime y crea el organizador `Jaime` con el correo `porra@jaimezpe.com`.

## Configurar Brevo

El correo se envía mediante Supabase Auth usando el SMTP de Brevo.

1. Verifica `jaimezpe.com` y el remitente `porra@jaimezpe.com` en Brevo.
2. En Supabase entra en `Authentication > SMTP Settings` y activa SMTP personalizado.
3. Usa el servidor, puerto, usuario y contraseña SMTP que facilita Brevo.
4. En la plantilla de correo de acceso de Supabase incluye el código `{{ .Token }}`.

El navegador nunca recibe la clave privada de Supabase ni las credenciales de Brevo. La función de acceso limita cada participante a tres solicitudes de código en cinco minutos.

## Funcionamiento del cuadro

Desde administración se crean los grupos y los partidos. Cada lado de un partido puede depender de:

- Primero o segundo de un grupo.
- Uno de los terceros clasificados.
- Ganador de un partido anterior.
- Perdedor de una semifinal, para el tercer puesto.
- Una selección fija.

Las opciones posteriores de cada participante se recalculan cuando cambia una elección anterior.

## Puntuacion inicial

- Grupos: 2 puntos por posición exacta y 1 si clasifica en otra posición.
- Dieciseisavos: 4 puntos por partido.
- Octavos: 7 puntos por partido.
- Cuartos: 10 puntos por partido.
- Semifinales: 12 puntos por partido.
- Tercer puesto: 12 puntos.
- Campeón: 20 puntos.
- Bota de Oro: 20 puntos.

Todas las cantidades se pueden cambiar desde administración.

## Web anterior

La versión anterior de la web está compilada en `public/webantigua` y se publica en la ruta `/webantigua/`.
