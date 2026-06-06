# Töreboda Hemvård - Schemamotor

## Projektets syfte

Bygga en deterministisk schemaläggningsmotor specifikt anpassad för hemvården i Töreboda kommun. Lösningen ska:

1. Lösa det specifika problemet: schemaläggning tar för lång tid (10 personer × 1 dag = miljonbelopp/år)
2. Minska överbemanning genom optimering enligt verksamhetens regler
3. Vara så specialanpassad till Töreboda att ingen generell leverantör kan matcha den
4. Vara begriplig och förklarbar - personalen ska alltid förstå varför schemat ser ut som det gör

## Vad detta INTE är

- Inte en generell WFM-plattform som Quinyx eller Medvind
- Inte AI/LLM-baserad - ren deterministisk optimering med transparent logik
- Inte ett brukarplaneringssystem (det sköts av LMO)
- Inte ett lönesystem (Personec används för det)

## Tekniska val

- **Frontend:** Next.js, deploy på Vercel
- **Backend/Databas:** Postgres på Railway
- **IDE:** Claude Code
- **Filhantering vid behov:** Cloudflare R2
- **Tidshantering:** date-fns-tz med Europe/Stockholm

## Designprinciper

1. **Transparens framför smarthet** - personalen ska alltid kunna se VARFÖR
2. **Förslag, inte beslut** - människan godkänner alla schemaändringar
3. **Determinism = förklarbarhet** - varje regel kan motiveras
4. **Specialanpassat till Töreboda** - inte byggt för "alla kommuner"
5. **Snabb iteration** - personalens feedback implementeras inom dagar, inte år

## Arbetsmetodik

Detta är ett LEVANDE PROJEKT där:

- Jimmy fyller på svar i `docs/research/questions.md` löpande
- Skärmdumpar från Personec (med maskerade namn) läggs i `docs/personec/`
- Lagar och regler dokumenteras i `docs/lagstiftning/`
- Claude Code ska ALLTID läsa dessa filer innan kodning eller beslut

## Hur Claude Code ska bete sig

1. **Innan du skriver kod** - läs ALLTID:
   - `docs/research/questions.md` för verksamhetskunskap
   - `docs/lagstiftning/regler.md` för juridiska tvingande regler
   - `docs/personec/observations.md` för hur befintlig data ser ut

2. **Frågar Jimmy om information saknas** - gissa inte, fråga
3. **Skriv kommentarer på svenska** - det är en svensk kontext
4. **Logga beslut i `docs/decisions/`** - varje större designval får en kort markdown-fil

## Kontext om Jimmy

- Jobbar i hemvården i Töreboda
- Bygger detta för sin egen arbetsplats först
- Vision om att kunna sprida till andra Skaraborgskommuner senare
- Förstår kod, kan ändra själv, men låter Claude Code göra grovarbetet
- Vill ha specialanpassning, inte generaliserade lösningar
