# Beslut: Deterministisk regelmotor, inte AI/LLM

**Datum:** 2026-05-19
**Status:** Beslutat

## Kontext

Marknaden för schemaläggning erbjuder flera AI/ML-baserade lösningar (Quinyx, Visma Medvind AutoSchema). Flera kommuner har implementerat dessa med blandade resultat:

- **Tjörn (2024):** Personal kände sig som "försökskaniner"
- **Kalmar (2025):** Personal upplever stress och saknar inflytande
- **Mellerud (2025):** Slopade AI-systemet efter problem
- **Degerfors:** Pågående pilotprojekt

Den gemensamma kritiken: brist på transparens, förlorad agens för personalen, "svart låda"-känsla.

## Beslut

Töreboda-motorn byggs som en **deterministisk regelmotor**, inte AI/LLM-baserad.

## Motivering

1. **Schemaläggning är ett klassiskt constraint satisfaction problem** - väl löst inom operations research sedan 60-talet
2. **Determinism = inbyggd förklarbarhet** - varje beslut kan motiveras med konkret regel
3. **AI Act-medvetenhet** - schemaläggning av anställda är högrisk enligt Annex III
4. **Lärdomar från andra kommuner** - bristande transparens har lett till misslyckanden
5. **Personalens förtroende** - en regel man kan förstå accepteras lättare

## Alternativ som övervägdes

### Alternativ A: LLM-baserad schemaläggning
Förkastat. LLM:er är dåliga på constraint satisfaction och kan inte ge garantier för regelefterlevnad. Risk för "hallucinerade" scheman som bryter mot lag.

### Alternativ B: Hybrid (regelmotor + AI för prognoser)
Möjligt i framtiden. AI kan tillföra värde för:
- Prognostisering av bemanningsbehov
- Förslag på omplaneringar
- Naturligt språk-gränssnitt

Men kärnan (själva schemaläggningen) ska vara deterministisk.

### Alternativ C: Pure ML/optimering (Quinyx-stil)
Förkastat för MVP. Inte för att tekniken är dålig - utan för att det inte ger oss en differentierad position. Vi vill INTE konkurrera på samma plan som de stora aktörerna.

## Konsekvenser

**Positivt:**
- Förklarbart för personal och chefer
- Lätt att verifiera mot lag
- Snabb iteration på regler
- Inga "konstiga" scheman

**Negativt:**
- Mindre "magiskt" att demonstrera
- Kräver explicit kodning av alla regler
- Kan behöva manuell justering vid sällsynta fall

## Referenser

- VLT debattartikel (april 2026): "AI är ingen mirakellösning för hemtjänsten"
- Göteborgsregionens innovationsarena om AI-genererad schemaläggning
