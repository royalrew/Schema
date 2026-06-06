# Sintari — Systemrapport
### Schemaläggningssystem för Töreboda hemvård
*Framtagen inför demonstration och feedback, juni 2026*

---

## Varför vi byggde detta

Idag lägger **2 personer per grupp en hel arbetsdag** varje månad på att skapa och rätta scheman för hand. Med 6 grupper innebär det:

| Post | Beräkning | Kostnad |
|------|-----------|---------|
| Schemaläggning | 12 pers × 8h × 12 mån | 1 152 h/år |
| Samordnare rättar | 1 pers × 8h × 12 mån | 96 h/år |
| **Totalt** | **1 248 timmar/år** | **~307 000 kr/år** |

**Målet:** Reducera en hel schemaläggningsdag per grupp till under 2 timmars granskning.

Systemet ersätter **inte** Medvind — det är ett komplement som genererar ett färdigt schema som sedan kan föras över. Medvind är och förblir den officiella källan för löneunderlag.

---

## Vad systemet kan göra idag

### 1. Önskeschema
Varje anställd loggar in och fyller i sina önskade arbetstider per dag. Systemet visar i realtid hur bemanningen ser ut, så personen kan anpassa sig efter vad gruppen redan har.

- Välj passtyp från förinställda tider (06:45–16:00, 13:45–21:30 etc.)
- Eller fyll i egna tider fritt
- Markera dagar som lediga
- Systemet validerar direkt mot 11-timmarsregeln

### 2. Automatisk schemaläggning
En knapptryckning genererar ett juridiskt korrekt schema för hela gruppen:

- Personal som lagt önskeschema prioriteras
- Personal som inte lagt något — systemet fyller i automatiskt
- Hela processen tar under ett halvt sekund

### 3. Granskning och korrigering
Chefen/schemaläggaren ser schemat och kan:

- Se direkta varningar om regler bryts eller bemanning saknas
- Klicka "Autofix" för att rätta kända problem automatiskt
- Justera enskilda pass manuellt
- Analysera schemat med AI som föreslår förbättringar

### 4. Attestering
Chefen godkänner schemat. Från det ögonblicket är det låst.

### 5. Export
- **PDF** — skriv ut och sätt upp, skicka till personal
- **Excel** — för import till Medvind/Personec

---

## Regler systemet tillämpar automatiskt

### Lagar (hårda — bryts aldrig)
| Regel | Vad det innebär |
|-------|----------------|
| **11h dygnsvila** | Minst 11 timmars vila mellan två pass |
| **36h veckovila** | Minst 36 timmars sammanhängande vila per kalendervecka (mån–sön) |
| **9 lediga dagar/28 dagar** | Minst 9 fria dagar i varje 28-dagarsperiod |
| **Frånvarospärr** | Ingen schemaläggning på registrerade frånvarodagar |
| **Max 2 veton/månad** | Personal kan blockera max 2 dagar |

### Lokala regler (hårda — bryts aldrig)
| Regel | Vad det innebär |
|-------|----------------|
| **06:45-regeln** | Exakt 1 person per grupp ska alltid börja 06:45 för nattrapporten |
| **Dagansvarig** | Dagansvarig tilldelas aldrig kväll- eller nattpass |
| **Kontraktstyp** | Dagtid jobbar bara mån–fre. Helgkontrakt jobbar bara sin helg. Nattpersonal jobbar bara natt. |
| **Max 2 helger/månad** | Varierande-personal arbetar exakt 2 helgdagar per månad |
| **Max 4 konsekutiva dagar** | Ingen jobbar mer än 4 dagar i rad (garanterar 36h vila) |

### Varningar (mjuka — flaggas men blockerar inte)
| Varning | Vad det betyder |
|---------|----------------|
| **06:45 saknas** | En dag har ingen person med tidig starttid — nattrapporten täcks inte |
| **Ingen jobbar till 21:30** | Kvällen slutar 20:00 — brukare som behöver sent kvällsbesök täcks inte |
| **Timsaldo** | Person är mer än 8h under eller över kontraktsmål |

---

## Kontraktstyper systemet hanterar

| Kontraktstyp | Timmar/vecka | Tillåtna dagar |
|---|---|---|
| Varierande | 37h | Alla dagar |
| Dagtid | 40h | Måndag–fredag |
| Kväll (kval) | 30h | Alla dagar, men bara kvällspass |
| Helg fre–sön | 26h | Fredag, lördag, söndag |
| Helg lör–mån | 26h | Lördag, söndag, måndag |
| Natt | 34,33h | Alla dagar, bara nattpass |

---

## Helgdefinition i systemet

Helgbemanning (lägre krav) gäller:
- Fredag kväll (13:45 och framåt)
- Hela lördagen
- Hela söndagen

Vardagsbemanning gäller måndag–torsdag (alla pass) och fredag morgon.

---

## Roller och behörigheter

| Roll | Kan göra |
|------|----------|
| **Superadmin** | Allt — skapa konton, attestera, se alla grupper, konfigurera systemet |
| **Schemaansvarig** | Kör autoschema, redigerar, ser sin grupp. Kan inte skapa konton. |
| **Personal** | Ser bara sitt eget schema och lägger önskeschema |

---

## Flödet steg för steg

```
Steg 1: Önskeläge
  → Personal loggar in och lägger in sina tider
  → Tidsfrist: bestäms av schemaansvarig

Steg 2: Automatisk generering
  → Schemaansvarig trycker "Kör autoschema"
  → Systemet genererar på under 1 sekund
  → Systemet visar direkt vad som behöver åtgärdas

Steg 3: Granskning
  → Schemaansvarig granskar, justerar
  → AI kan föreslå förbättringar baserat på personalens personkort

Steg 4: Attestering
  → Chef godkänner schemat — det låses
  → Exportera till PDF och/eller Excel
```

---

## Personkort (livsmönster)

Varje anställd kan ha återkommande preferenser i sitt personkort:
- "Föredrar ledig varannan lördag" (barn varannan helg)
- "Undviker kvällar på fredagar"

AI:n analyserar schemat mot dessa preferenser och föreslår justeringar. Preferenserna är **mjuka** — de bryts om bemanningen kräver det.

---

## Timsaldo

Systemet spårar varje persons plus/minustid mot kontraktsmålet.

- Systemets siffror är **planeringsunderlag**, inte löneunderlag
- Medvind är den officiella källan
- Schemaansvarig kan manuellt fylla i ingångssaldo från Medvind

---

## Vad systemet INTE gör (medvetna avgränsningar)

- **Ersätter inte Medvind** — schemat exporteras och förs över manuellt
- **Hanterar inte lön, OB eller kollektivavtal** — detta tillhör Medvind och HR
- **Planerar inte brukartider** — brukarplaneringen finns kvar i LMO
- **Attesterar inte löneunderlag** — det gör chef i Medvind som vanligt

---

## Öppna frågor — feedback önskas

Systemet är byggt utifrån det vi vet idag. Det finns säkert saker vi missat eller missat nyansera. Några specifika frågor:

1. **Helgdefinition** — stämmer det att fredag kväll räknas som helgbemanning?
2. **Bemanningskrav** — är standardvärdet (3 dag + 2 kväll för Norra) korrekt?
3. **06:45-regeln** — gäller den varje dag, även helger?
4. **Dagansvarig** — hur väljs vem som är dagansvarig? Roterar det eller är det fast?
5. **Önskeschema** — när är senaste datum personal ska ha lagt in sitt schema?
6. **Kontorstid** — hur ofta per månad har personal kontorstid, och vem bestämmer det?
7. **Passbyten** — ska personal kunna byta pass med varandra i systemet, eller hanteras det utanför?

---

## Teknisk sammanfattning

| Komponent | Teknologi |
|-----------|-----------|
| Frontend | Next.js (webbapp, mobilanpassad) |
| Backend | Python/FastAPI |
| Databas | PostgreSQL |
| Hosting | Railway (planerat) + Vercel |
| AI | OpenAI GPT-4o-mini (schema-analys) |

Systemet är byggt specifikt för Töreboda hemvård och kan anpassas för andra kommuner.

---

*Sintari · Specialbyggda schemasystem · 2026*
