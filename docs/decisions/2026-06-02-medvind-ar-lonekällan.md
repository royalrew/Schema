# Beslut: Medvind är den officiella lönekällan — vi ersätter den inte

**Datum:** 2026-06-02  
**Beslutsfattare:** Jimmy Berndtsson

## Beslut

Töreboda schemamotor är ett **planeringsverktyg**, inte ett lönesystem. Medvind är och förblir den officiella källan för löneunderlag, timbank och OB-ersättning.

## Kontext

Diskussion om timbank (plus/minustid) uppstod — ska systemet synka med Medvind eller hålla en egen räkning?

## Vad vi GÖR

- Visa beräknat timsaldo baserat på planerade timmar (indikation för planeringen)
- Låta schema-ansvarig manuellt ange ett ingångssaldo från Medvind varje period
- Kommunicera tydligt i UI att siffrorna är uppskattningar, inte officiella

## Vad vi INTE gör

- Integrera med Medvind API
- Hantera OB-tid, röda dagar, sjuklön eller andra lönekomponenter
- Ersätta Medvind-attestering

## Motivering

Medvind har komplexa löneberäkningar (OB, kollektivavtal, sjuklön) som vi inte kan eller bör återskapa. Vårt värde är i **schemaoptimeringen**, inte löneredovisningen. En felaktig löneberäkning kan ha juridiska konsekvenser — det är inte vår roll.
