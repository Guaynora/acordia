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

Requirements: Node.js 22+, Docker.

```sh
cp .env.example .env   # then set a password
npm run db:up          # starts PostgreSQL on localhost:5432
```
