# Acordia

A chord sheet platform with musically correct transposition, YouTube/Spotify links and a built-in metronome.

- **Transposition that respects the key**: Bb stays Bb in F, slash-chord basses move, and a section that modulates keeps its own spelling. Capo suggestions included.
- **Views** for guitar, ukulele, piano and bass, plus chords as scale degrees (Nashville numbers), lyrics only, and a chord grid.
- **Practice tools**: a metronome with subdivisions and count-in, and auto-scroll that follows it bar by bar.
- **Songs that change**: tempo, meter, accent grouping, tempo ramps and key change by section; bar lines, repeats, first and second endings, and D.S./D.C. jumps are followed while playing. The syntax is in [docs/song-format.md](docs/song-format.md).
- Accounts with Google sign-in, versions (arrangements) of each song, public profiles and favorites, in Spanish and English.

## Structure

Clean Architecture in a pnpm monorepo: the chord engine lives in
`packages/chord-engine` and the web app in `apps/web`. Layers, data model,
sign-in and permission flows are drawn in
[docs/architecture.md](docs/architecture.md).

## Local development

Requirements: Node.js 22+, pnpm, Docker.

```sh
cp .env.example .env              # then set a password
pnpm install
pnpm db:up                        # PostgreSQL on localhost:5432
pnpm --filter @acordia/web db:migrate
pnpm --filter @acordia/web db:seed   # optional sample songs
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

### Sample songs

`db:seed` publishes two public-domain songs and three versions of Amazing Grace made for trying the practice tools:

| Path | What it shows |
| --- | --- |
| `/es/songs/cielito-lindo-tradicional` | A short song in 3/4 |
| `/es/songs/amazing-grace-john-newton` | One chord per bar, about four minutes long |
| `…/amazing-grace-john-newton/final-en-ab` | A 4/4 interlude, a faster verse, a modulation to Ab and a final ritardando |
| `…/amazing-grace-john-newton/con-compases` | Bar lines: two chords in a bar and held bars |
| `…/amazing-grace-john-newton/con-repeticiones` | An intro played twice, first and second endings, and a D.S. al Coda |

It only adds what is missing, so it can be run again after new seed songs are added.

### Feature flags

Set in `.env` (or `.env.local`); `true`, `1`, `on` or `yes` turns a flag on. They are read on each request, so restarting the dev server is enough.

| Variable | What it turns on |
| --- | --- |
| `FEATURE_AUTO_SCROLL` | The auto-scroll card, and the sheet following the metronome |

Checks: `pnpm test` and `pnpm typecheck` run across all packages.

Database changes: edit `apps/web/src/infrastructure/db/schema.ts`, then run
`pnpm --filter @acordia/web db:generate` and commit the new migration in
`apps/web/drizzle/`.

## License

[MIT](LICENSE). Bundled third-party data is listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
