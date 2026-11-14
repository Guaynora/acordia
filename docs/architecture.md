# Arquitectura de Acordia

Guía rápida de cómo está construida la web. Para levantarla en local, ver el [README](../README.md).

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
    ports["Puertos<br/>SongRepository · UserRepository<br/>FavoriteRepository"]
  end
  subgraph I["Infraestructura · src/infrastructure"]
    repos["Repositorios Drizzle"]
    auth["Better Auth"]
  end
  db[("PostgreSQL")]
  google(["Google OAuth"])

  pages --> uc --> model
  uc --> ports
  repos -. implementa .-> ports
  repos --> db
  auth --> db
  auth <--> google
  pages --> auth

  classDef domain fill:#fde7d3,stroke:#c2410c,color:#431407
  classDef app fill:#e0ecff,stroke:#1d4ed8,color:#172554
  classDef infra fill:#e7f5e9,stroke:#15803d,color:#052e16
  class model,ports domain
  class uc app
  class repos,auth infra
```

Las flechas apuntan hacia dentro: el dominio no conoce Next.js, Postgres ni Google. `src/infrastructure/container.ts` es el único sitio que decide qué repositorio implementa cada puerto.

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
