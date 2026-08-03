# KM.OS

Je eigen systeem: acht apps op één gedeelde kern. Alles draait lokaal in je browser
en werkt zonder account, zonder server en zonder internet. De koppelingen met
Supabase, PostHog en Vercel zijn optioneel — je zet ze aan wanneer je ze nodig hebt.

## Binnenkomen

`login.html` → `os/index.html`

Wachtwoord: **kmdev2026** (staat als SHA-256 hash in `login.html`, regel met `const HASH`).
Wil je het wijzigen: bereken de hash van je nieuwe wachtwoord en vervang die regel.

```bash
echo -n "jouwnieuwewachtwoord" | shasum -a 256
```

## De apps

| App | Bestand | Wat het doet |
|---|---|---|
| Launcher | `index.html` | Startscherm, snelle vastlegging, live cijfers, systeemstatus |
| Life OS | `life-os.html` | Levensgebieden → doelen → projecten → taken, gewoontes, prioriteitenmatrix, weekreview |
| Mind Matrix | `matrix.html` | Alles als één graaf: sleep, zoom, filter, focus |
| AI Scheduling | `schedule.html` | Plant je week automatisch op deadline, prioriteit, energie en capaciteit |
| Video Studio | `video.html` | Storyboard, draaiboek, shotlist — optioneel met AI-beeld |
| Design Studio | `design.html` | Zes on-brand sjablonen, live SVG-preview, PNG-export op 2× |
| Notities | `../dashboard.html` | Je eigen Notion-werkruimte |
| Integraties | `integrations.html` | Supabase, AI-proxy, PostHog, Vercel |

## Hoe alles samenhangt

```
Levensgebied  ─┬─ Doel ─┬─ Project ─┬─ Taak ─── ingepland blok (Scheduler)
               │        │           └─ Taak
               │        └─ Project
               └─ Gewoonte

Notitie ──► Doel          Notion-pagina ──► subpagina
```

De Mind Matrix leest al deze verbanden — inclusief je Notion-pagina's — en tekent ze
als één netwerk. De Scheduler leest dezelfde taken en plant ze in. Vink je iets af in
de launcher, dan zie je dat terug in de voortgangsring van het doel.

## Opslag

| Sleutel | Inhoud |
|---|---|
| `kmdev_os_v1` | Life OS: doelen, projecten, taken, gewoontes, planning, scenes, ontwerpen |
| `kmdev_workspace_v1` | Notion-werkruimte |
| `kmdev_os_settings` | Integraties en thema |
| `kmdev_session` | Je inlogsessie |

localStorage heeft ongeveer 5 MB ruimte. De opslagmeter staat bij Integraties.
**Browsergeschiedenis wissen wist ook je data** — maak dus regelmatig een backup,
of zet Supabase-sync aan.

## Integraties aanzetten

### Supabase — je data in de cloud
1. Maak een project op supabase.com
2. Draai `supabase-schema.sql` in de SQL Editor
3. Vul Project-URL en anon key in bij Integraties, klik Opslaan en dan Verbinding testen
4. Zet auto-sync aan

De anon key staat in je browser en is dus niet geheim. Bewaar hier geen gegevens
van anderen.

### AI-proxy — voor Video en Design
Je API-sleutel hoort niet in de browser. `api/ai.js` is een serverless functie voor
Vercel die de sleutel serverside houdt. Hij ondersteunt OpenAI-compatibele API's,
Replicate, fal en Hugging Face — kwestie van de juiste env-vars zetten.

Zonder AI blijven beide studio's volledig bruikbaar: storyboards, draaiboeken,
shotlists en alle design-sjablonen werken zonder key.

### PostHog — je eigen gebruik meten
Alleen gebeurtenissen (welke app, hoeveel taken af, hoe vaak gepland), nooit inhoud.
Staat de schakelaar uit, dan wordt het script niet eens geladen.

### Vercel — hosten
Push naar GitHub, importeer op vercel.com, framework preset `Other`, geen build command.
`vercel.json` staat klaar in de projectmap; alles in `api/` wordt automatisch een functie.

## Sneltoetsen

| Toets | Waar | Wat |
|---|---|---|
| `/` | Launcher | Spring naar de vastlegbalk |
| `⌘K` | Notities | Zoeken |
| `⌘\` | Notities | Sidebar in- of uitklappen |
| dubbelklik | Mind Matrix | Focus op een knoop en zijn buren |
| `Esc` | overal | Sluit het bovenste paneel |

## Snel vastleggen

In de vastlegbalk van de launcher:

- `!` → prioriteit kritiek
- `vandaag` of `morgen` → zet meteen de deadline
- `#tag` → voegt een label toe

`Facturen sturen morgen #admin !` wordt een taak met deadline morgen, label `admin`
en de hoogste prioriteit.

## Ontwikkelnotities

- Geen build-stap, geen dependencies. Open een bestand en het werkt.
- `km-os.css` en `km-os.js` zijn de gedeelde kern; elke app laadt ze als eerste.
- Een nieuwe app toevoegen: zet hem in de array `APPS` in `km-os.js`, roep
  `KM.shell({ app:'jouwid' })` aan en je hebt automatisch de balk, het thema,
  de app-switcher en de analytics.
- Alle datum-, kleur- en tekstlogica zit in `KM.*` zodat apps consistent blijven.
