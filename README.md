# Post Studio

Self-hosted, Dockerised studio for Multiicon's social media: plan the week, pick and polish event
photos, let Claude write three options per post, generate visuals with FLUX / Gemini / GPT Image /
Ideogram / Kling, approve, and publish to Instagram on schedule.

```bash
cp .env.example .env   # fill the passwords, PUBLIC_BASE_URL and whichever API keys you have
docker compose up -d --build
open http://localhost:8080
```

For HTTPS on your own subdomain:

```bash
DOMAIN=social.example.com docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d --build
```

- `docs/IMPLEMENTATION.md`: how it works today and what is still stubbed
- `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`: the target design and decisions
- `CLAUDE.md`: rules for anyone (human or Claude) changing this code

Nothing is published without a person approving it in the UI, and publishing stays off
(`IG_PUBLISH_ENABLED=false`) until the Instagram test account has been verified.

## Develop

```bash
docker compose up -d db
export DATABASE_URL=postgres://poststudio:poststudio@localhost:5432/poststudio
npm install && npm run dev      # http://localhost:8080
npm test && npm run typecheck
```
