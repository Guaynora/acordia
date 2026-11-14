# Arquitectura de Acordia

Guía rápida de cómo está construida la web. Para levantarla en local, ver el [README](../README.md); para lo que se puede escribir en una canción, [song-format.md](song-format.md).

## Capas

```mermaid
flowchart LR
  subgraph P["Presentación · src/app, src/components"]
    pages["Páginas y server actions"]
  end
  subgraph A["Aplicación · src/application"]
    uc["Casos de uso<br/>PublishSong · EditArrangement<br/>DeleteArrangement · SetFavorite…"]
  end
  subgraph D["Dominio · src/domain + chord-engine"]
    model["Song · Arrangement · User<br/>permissions · handle"]
    music["Reproducción<br/>scroll-timeline · tempo-map<br/>meter · metronome-ticker"]
    ports["Puertos<br/>SongRepository · UserRepository<br/>FavoriteRepository"]
  end
  subgraph I["Infraestructura · src/infrastructure"]
    repos["Repositorios Drizzle"]
    auth["Better Auth"]
  end
  db[("PostgreSQL")]
  google(["Google OAuth"])

  pages --> uc --> model
  pages --> music
  uc --> ports
  repos -. implementa .-> ports
  repos --> db
  auth --> db
  auth <--> google
  pages --> auth

  classDef domain fill:#fde7d3,stroke:#c2410c,color:#431407
  classDef app fill:#e0ecff,stroke:#1d4ed8,color:#172554
  classDef infra fill:#e7f5e9,stroke:#15803d,color:#052e16
  class model,ports,music domain
  class uc app
  class repos,auth infra
```

Las flechas apuntan hacia dentro: el dominio no conoce Next.js, Postgres ni Google. `src/infrastructure/container.ts` es el único sitio que decide qué repositorio implementa cada puerto.

El motor de acordes (`packages/chord-engine`) es TypeScript puro y se usa igual en el navegador y en el servidor: parseo, transposición, importador, grados, digitaciones, directivas de tempo y orden de ejecución.

## Tocar una canción

El metrónomo es el reloj: todo lo demás sigue los compases que él cuenta.

```mermaid
flowchart LR
  cp["ChordPro<br/>de la versión"] --> tr["transposeChordPro<br/>(tono y cejilla)"]
  tr --> parse["parseChordProSong"]
  parse --> order["performanceOrder<br/>repeticiones, casillas, D.S."]
  order --> tl["buildScrollTimeline<br/>pasos y compases"]
  tl --> map["buildTempoMap<br/>tempo, compás y tono<br/>por compás"]
  map --> metro["Metrónomo<br/>MetronomeTicker"]
  tl --> scroll["Auto-scroll"]
  metro -- "start · beat(compás, tiempo) · stop" --> clock(("PracticeClock"))
  clock --> scroll
  scroll -- "dónde empezar · saltar a" --> clock
  clock --> metro
  scroll --> sheet["ChordSheet<br/>resalta y desplaza"]

  classDef engine fill:#fde7d3,stroke:#c2410c,color:#431407
  classDef ui fill:#e0ecff,stroke:#1d4ed8,color:#172554
  class tr,parse,order engine
  class metro,scroll,sheet ui
```

- **Línea de tiempo** (`domain/scroll-timeline.ts`): recorre las líneas en el orden en que se tocan y da a cada acorde su duración en compases. `lineBars` aplica las reglas de las barras `|`, y la vista de cuadrícula usa la misma función.
- **Mapa de tempo** (`domain/tempo-map.ts`): parte del tempo, compás y tono de la canción y añade una sección en el compás donde se alcanza cada directiva, incluida cada pasada de una repetición.
- **Metrónomo** (`components/metronome.tsx`):
  - programa los clics en el reloj de Web Audio con un poco de antelación;
  - en cada clic pide al mapa el tempo y el compás de su posición, así que las rampas y los cambios salen solos;
  - el BPM que pone la persona escala todo el mapa.
- **PracticeClock** (`components/practice-clock.tsx`): un bus de eventos, no estado de React, para que un tiempo no vuelva a dibujar la página.
  - El metrónomo emite `beat` con el compás y el tiempo que suenan.
  - El auto-scroll indica dónde empezar y puede pedir un salto, que se aplica en el siguiente "1".
- **Vistas** (`components/use-sheet-view.ts`): acordes, grados (`chordDegree`, con el tono de cada línea según `keysByLine`), solo letra y cuadrícula. Se recuerda en `localStorage`.

### Feature flags

`src/config/features.ts` lee variables de entorno en el servidor en cada petición, así que basta con reiniciar el servidor (no hay que recompilar). Ahora solo hay una: `FEATURE_AUTO_SCROLL`, que muestra la tarjeta de auto-scroll y hace que la hoja siga al metrónomo.

## Datos

```mermaid
erDiagram
  users ||--o{ sessions : "inicia"
  users ||--o{ accounts : "vincula (Google)"
  users |o--o{ songs : "crea"
  users |o--o{ arrangements : "es autor de"
  users ||--o{ favorites : "guarda"
  songs ||--|{ arrangements : "tiene versiones"
  songs ||--o{ recordings : "enlaza"
  arrangements ||--o{ favorites : "aparece en"

  users {
    uuid id PK
    text handle UK "alias público: /u/handle"
    text email UK "nunca se muestra"
    enum role "user | moderator | admin"
  }
  songs {
    uuid id PK
    text slug UK
    text original_key
    int tempo
    text time_signature
  }
  arrangements {
    uuid id PK
    text slug "único por canción"
    enum kind "original, simplified, ..."
    text key
    text chordpro
    uuid author_id FK "null en versiones antiguas"
  }
  favorites {
    uuid user_id PK
    uuid arrangement_id PK
  }
```

- La **primera versión** de una canción (la original) lleva el tono, tempo y compás de la canción; las demás solo guardan tempo o compás si cambian.
- Borrar una cuenta **no** borra lo que publicó (`author_id` pasa a null); sí borra sus sesiones y favoritos.

## Entrar con Google

```mermaid
sequenceDiagram
  autonumber
  actor P as Persona
  participant W as Acordia
  participant G as Google
  participant DB as Postgres

  P->>W: "Continuar con Google"
  W->>G: redirige (OAuth)
  G-->>W: /api/auth/callback/google
  W->>DB: crea usuario + alias si es nuevo
  W->>DB: crea sesión
  W-->>P: cookie de sesión y vuelta a la página de origen
```

Better Auth hace todo el flujo. La única lógica propia es asignar el alias (`jonathan-guaynora`, `-2` si se repite) en `infrastructure/auth/auth.ts`.

## Una acción protegida

Publicar, editar, borrar y guardar en favoritos siguen el mismo camino:

```mermaid
flowchart LR
  form["Formulario"] --> action["Server action"]
  action --> session{"¿Sesión?"}
  session -- no --> login["/login?next=…"]
  session -- sí --> uc["Caso de uso<br/>(recibe el actor)"]
  uc --> perm{"¿Permiso?<br/>domain/permissions.ts"}
  perm -- no --> err["Error: forbidden"]
  perm -- sí --> repo[("Repositorio")]
  repo --> done["Redirect o refresh"]
```

La página también oculta los botones a quien no tiene permiso, pero eso es solo comodidad: **la comprobación que cuenta es la del caso de uso**.

## Quién puede editar o borrar una versión

```mermaid
flowchart TD
  start(["Borrar versión"]) --> who{"¿Es autor, moderador o admin?"}
  who -- no --> no1["No permitido"]
  who -- sí --> first{"¿Es la versión original?"}
  first -- no --> del["Se borra la versión"]
  first -- sí --> only{"¿Es la única versión?"}
  only -- sí --> song["Se borra la canción entera"]
  only -- no --> no2["No permitido:<br/>hay otras versiones encima"]

  classDef ok fill:#e7f5e9,stroke:#15803d,color:#052e16
  classDef stop fill:#fde2e2,stroke:#b91c1c,color:#450a0a
  class del,song ok
  class no1,no2 stop
```

Editar sigue la misma regla de permiso. Editar la original cambia también el tono, tempo y compás de la canción; la URL de una versión nunca cambia.

## Rutas

| Ruta | Qué es | Cuenta |
| --- | --- | --- |
| `/[lang]` | Buscar canciones | — |
| `/[lang]/songs/[slug]` | Canción (su versión original) | — |
| `/[lang]/songs/[slug]/[version]` | Otra versión | — |
| `/[lang]/songs/new` · `/[lang]/songs/[slug]/new` | Subir canción o versión | sí |
| `/[lang]/songs/[slug]/[version]/edit` | Editar versión | autor o moderador |
| `/[lang]/u/[handle]` | Perfil público | — |
| `/[lang]/favorites` | Tus favoritos (privados) | sí |
| `/[lang]/login` | Entrar | — |
| `/api/auth/*` | Better Auth (OAuth, sesión) | — |

`[lang]` es `es` o `en`; sin prefijo, `proxy.ts` elige el idioma del navegador.
