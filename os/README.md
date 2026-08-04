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
| Dashboard | `index.html` | Bento-dashboard met weer, live cijfers, charts, feed en snelle vastlegging |
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

## Vormgeving

Het hele systeem draait op één materiaal-laag in `km-os.css`:

- **Echt logo** — `km-brand.js` bouwt het KM.dev-mark (squircle, KM, lime balk) als inline SVG,
  plus een **app-icoon per app**: squircle met verloop, glansrand en een eigen getekende glyph
- **Vibrancy** — panelen zijn matglas met `backdrop-filter`, vierlaagse schaduwen zoals macOS
- **Springs** — knoppen veren in bij hover, drukken in bij klik; panelen komen met een spring binnen
- **Segmented controls** met een thumb die meeglijdt, in plaats van losse knoppen
- **Launchpad** — `⌘K` of de rasterknop opent alle apps groot over een blur, met zoeken,
  pijltjesnavigatie en een spring-stagger
- **Boot-sequence** — na het inloggen bouwt het logo zich op, trekt een lime lijn zich rond de
  squircle, en vliegen de app-iconen van onderen in

## Merklogo's

`km-logos.js` bevat de **echte logo's** van de diensten waar dit systeem op leunt.
De paden komen uit [Simple Icons](https://simpleicons.org) (CC0), de kleuren zijn de
officiële merkkleuren.

| Merk | Waar |
|---|---|
| Figma | Design Studio — "Kopieer voor Figma" plakt de SVG bewerkbaar in een frame |
| Notion | Het app-icoon van Notities |
| Supabase | Integraties, in merkgroen met verloop |
| PostHog · Vercel · GitHub | Integraties |
| Open-Meteo | Credit onderin de weertegel |
| Hugging Face · Replicate | De merkenrij bij Integraties |

Figma tekenen we in kleur (de vijf vormen), Supabase krijgt een verloop over het
officiële silhouet. Notion, Vercel, PostHog en GitHub zijn zwart zoals hun huisstijl
voorschrijft; in donkere modus keren ze om naar wit.

Merknamen en logo's zijn eigendom van de betreffende bedrijven en staan hier alleen
om te laten zien welke dienst waar gebruikt wordt.

## Visuals

`km-viz.js` levert acht SVG-visuals die overal hetzelfde werken en meebewegen met je thema:

| Functie | Waar je hem ziet |
|---|---|
| `radar` | Levensbalans over zes gebieden — launcher en Life OS |
| `stack` | Werkverdeling als gestapelde capsule — verving de donut |
| `area` | 30 dagen momentum, verloop in de weekreview |
| `bars` | Uren per dag in de Scheduler, aandacht per gebied |
| `heatmap` | 17 weken activiteit; per gewoonte klikbaar om een dag terug te zetten |
| `gauge` | Weekbezetting |
| `ring` | Voortgang per doel, per gewoonte, per focusblok |
| `spark` | Miniatuurgrafiekjes op de app-tegels |

Alles animeert bij binnenkomst: bogen tellen op, staven groeien, de radar klapt open,
de heatmap komt cel voor cel binnen.

## Weer

Live weer via **Open-Meteo** — geen API-sleutel, geen account, geen limiet voor persoonlijk gebruik.

- Huidige temperatuur, gevoelstemperatuur, wind, luchtvochtigheid en UV
- Zesdaagse verwachting met min/max en een eigen geanimeerd icoon per dag
- Uurverwachting met temperatuurcurve en neerslagkans als balkjes eronder
- Zonneboog met de stand van de zon op dit moment, plus daglengte
- De hele tegel én de aurora op de achtergrond kleuren mee met het weer en met
  dag of nacht — onweer wordt paars, regen blauw, helder weer warm
- Iconen zijn zelfgetekende SVG's die bewegen: de zon draait, wolken driften,
  druppels vallen, sneeuw dwarrelt, de bliksem flitst
- Antwoorden worden 20 minuten gecachet; ben je offline, dan zie je de laatste
  stand met een melding erbij

Plaats wijzigen doe je door op de plaatsnaam in de weertegel te klikken: zoek een
stad of gebruik je huidige locatie.

## De klok

Op het dashboard staat geen cijferklok maar een **canvas-kunstwerk** (`km-clock.js`)
dat de tijd niet alleen afleesbaar maakt maar ook laat voelen.

Drie vormen, klik om te wisselen (je keuze wordt onthouden):

| Modus | Wat je ziet |
|---|---|
| **chrono** | Zestig seconde-tikken rond de rand; elke voorbije tik licht op en popt kort naar buiten. Een komeet met staart loopt de secondering rond. De minuten zijn een dikke boog die zachtjes golft. Twaalf uur-punten waarvan de huidige pulseert. Binnenin draait een fijne ring traag mee. |
| **orbit** | Drie hemellichamen op gekantelde ellipsbanen — seconde, minuut en uur — elk met een uitdovende staart. |
| **bloom** | Drie ringen van punten die vollopen: zestig voor seconden, zestig voor minuten, en twaalf bloemblaadjes voor de uren. |

Wat er in alle drie doorloopt:

- **De kleur volgt het uur.** Nacht is diepblauw, dageraad roze, ochtend amber, middag
  lime, namiddag oranje, schemer paars. Het palet interpoleert continu, dus de tint
  schuift de hele dag door. Het dagdeel staat in woorden onder de cijfers.
- **Cijfers morphen.** Wisselt een cijfer, dan schuift het oude omhoog weg met blur
  terwijl het nieuwe van onderen inveert.
- **Zonneboog.** Zodra het weer binnen is tekent de chrono-modus een dunne boog van
  zonsopkomst tot ondergang, met een gloeiend stipje op de werkelijke stand van de zon.
- **Parallax.** Het hele stuk kantelt zachtjes mee met je muis, en ademt langzaam.
- **Contrast klopt in beide thema's.** De dagkleur kan bleek zijn (lime op de middag),
  dus voor lijnen en punten wordt hij in lichte modus 45% naar ink getrokken. De zachte
  gloed eronder gebruikt wél de rauwe kleur.

## Live

`km-live.js` maakt het systeem levend:

- **Klok** in de balk en groot in de hero, met hoeveel werkdag je nog hebt
- **Focus-timer** die doorloopt als je naar een andere app gaat, en zelfs als je de tab
  sluit en terugkomt. Rond je hem af, dan wordt de gekozen taak afgevinkt. Start hem
  vanaf de launcher, vanaf een taak in Vandaag, of vanaf het blok dat nu loopt in de Scheduler
- **Cross-tab sync** — open KM.OS in twee tabbladen en een wijziging in het ene verschijnt
  direct in het andere. Ook je thema en je uitloggen volgen mee
- **Activiteitenfeed** met de laatste tachtig gebeurtenissen en tijden die meelopen
- **Netwerkstatus** in de balk; offline blijft alles gewoon lokaal werken
- **Nu-lijn** in de Scheduler die elke twintig seconden verschuift, met aftelling van het
  lopende blok
- **Deeltjes** die door de verbindingen van de Mind Matrix stromen, en een puls om knopen
  die je net hebt aangeraakt

## Opslag

| Sleutel | Inhoud |
|---|---|
| `kmdev_os_v1` | Life OS: doelen, projecten, taken, gewoontes, planning, scenes, ontwerpen |
| `kmdev_workspace_v1` | Notion-werkruimte |
| `kmdev_os_settings` | Integraties en thema |
| `kmdev_session` | Je inlogsessie |
| `kmdev_focus_timer` | De lopende focus-timer |
| `kmdev_weather` / `kmdev_weather_place` | Weercache en gekozen plaats |

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
