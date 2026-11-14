# Acordia

A chord sheet platform with musically correct transposition, YouTube/Spotify links and a built-in metronome.

## Structure

The project follows Clean Architecture: dependencies point inward, and the domain knows nothing about frameworks, databases or external services.

| Layer | Location | Contents |
| --- | --- | --- |
| Domain | `packages/chord-engine`, `apps/web/src/domain` | Chord, Key, Interval, Song, Arrangement, Recording; repository interfaces |
| Application | `apps/web/src/application` | Use cases: upload arrangement, transpose, add recording, search |
| Infrastructure | `apps/web/src/infrastructure` | Postgres repositories, oEmbed client, auth |
| Presentation | `apps/web/src/app` | Next.js routes and components, metronome, i18n (es/en) |

## Local development

Requirements: Node.js 22+, pnpm, Docker.

```sh
cp .env.example .env              # then set a password
pnpm install
pnpm db:up                        # PostgreSQL on localhost:5432
pnpm --filter @acordia/web db:migrate
pnpm --filter @acordia/web db:seed   # optional sample song
pnpm --filter @acordia/web dev       # http://localhost:3000
```

### Accounts (Google sign-in)

Reading and transposing work without an account; publishing requires one.
Sign-in uses [Better Auth](https://www.better-auth.com) with Google, and
users, sessions and accounts live in the same Postgres database.

1. Generate `BETTER_AUTH_SECRET` with `openssl rand -base64 32`.
2. In [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials),
   create an OAuth client ID of type *Web application* (free).
3. Add the authorized redirect URI `http://localhost:3000/api/auth/callback/google`.
4. Put the client ID and secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`,
   in `.env` or in a root `.env.local` (git-ignored, takes precedence).

Without them the site runs normally, but nobody can sign in.

Checks: `pnpm test` and `pnpm typecheck` run across all packages.

Database changes: edit `apps/web/src/infrastructure/db/schema.ts`, then run
`pnpm --filter @acordia/web db:generate` and commit the new migration in
`apps/web/drizzle/`.

## License

[MIT](LICENSE)
