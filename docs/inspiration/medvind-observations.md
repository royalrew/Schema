# Medvind WFM - Observationer och lärdomar

> **Levande dokument** — Jimmy lägger till förklaringar löpande.
> Format: Observation → Jimmys förklaring → Vad VI ska göra
>
> Status-ikoner:
> - ❓ Behöver Jimmys förklaring
> - ✅ Förstått och dokumenterat
> - 🎯 Designbeslut taget för vår lösning

---

## 📅 KALENDERVY (Bild 1)

### O-K1: Färgkodning på dagarna
**Observation:** Orange/lax = arbetsdag, cyan/ljusblå = ?, gul-vit = Ledig  
**Status:** ✅ delvis  
**Jimmys förklaring:** Cyan troligen bara estetik — ingen känd funktionell skillnad  
**Vår lösning:** 🎯 Vi använder meningsfull färgkodning — ingen "bara estetik"-färg

---

### O-K2: Aktivitetskoder och tidstyper
**Observation:** Varje pass har en tidskod + bokstavskod  
**Status:** ✅ — fullständig lista bekräftad via Daginformation-dialogens "Typ av tid"-dropdown (Jimmys Medvind, sept 2026)

**Kalender-koder (förkortningar):**

| Kod | Fullständigt namn i Medvind | Källa | Notering |
|---|---|---|---|
| `Ar` | Arbete | Dropdown ✅ | Ordinarie arbetspass |
| `An` | Annat arbete | Dropdown ✅ + Jimmy ✅ | Kontorstid, administration |
| `Bo` | Bokad | Jimmy ✅ | Bokad på pass |
| `Ka` / `Ti` | Tillgänglig | Dropdown ✅ | Gäller vikarier/timavlönade |
| `Ej` | Ej tillgänglig | Manual ✅ | Gäller vikarier/timavlönade |
| `Sj` | Sjukdom | Frånvaro ✅ | Frånvaroorsak |
| `Me` | ? | Skövde-kalender | ❓ Jimmys bekräftelse |
| `TU` | Utb Kurs Konf? | Skövde-kalender | ❓ Jimmys bekräftelse |
| `Ob` | **Obekväm arbetstid (OB)** — tid som ger OB-ersättning | December-kalender ✅ | 12/12: 08:30-14:00 Ob + 14:00-16:00 Ob |

**Fullständig "Typ av tid"-lista från Medvind (Jimmy Berndtsson, Töreboda):**

| Typ av tid | Vad det troligen innebär | Notering |
|---|---|---|
| Annat arbete | Kontor, administration | = `An` |
| Arbete | Ordinarie arbetspass | = `Ar` |
| Extra Jourvik Ledig | Extra jour/vikarie — kompenseras som ledig tid | ❓ Töreboda-specifik? |
| Extra Jourvik Pengar | Extra jour/vikarie — kompenseras som pengar | ❓ |
| Extratid vid vik L | Övertid vid vikariat — ledig kompensation | ❓ |
| Extratid vid vik P | Övertid vid vikariat — pengakompensation | ❓ |
| Extratidl | Övertid — ledig kompensation | ❓ |
| Extratidp | Övertid — pengakompensation | ❓ |
| Jour LSS | Jourtid specifikt för LSS-verksamhet | Töreboda har LSS? ❓ |
| Obokat arbete | **Obokad tur** — schemalagd men utan specifik grupptilldelning. Används som flexibel buffert vid sjukdom/högt tryck i grupper. | ✅ Jimmy bekräftat |
| Rast | Rast/paus | Ingår ej i arbetstid |
| Tillgänglig | Tillgänglighet registrerad | Vikarier |
| Timbanken + | Insättning i timbank | Frivillig plusbank |
| Utb Kurs Konf Ledig | Utbildning/kurs/konferens — kompenseras ledig | = `TU`? |
| Utb Kurs Konf pengar | Utbildning/kurs/konferens — kompenseras pengar | |
| Veto | Formellt veto — kan absolut ej arbeta denna tid | Se O-NY2 |

**Jimmys frågor:** ❓ Används Jour LSS i Töreboda? Hur vanlig är "Obokat arbete"?  
**Vår lösning:** 🎯 Visa fulltext alltid. Bara relevanta typer för Töreboda visas — ingen dropdown med 16 val.

---

### O-K3: Varningstriangel (⚠️) på dagar
**Observation:** Liten orange triangel i övre vänster hörn på dagar med regelbrott  
**Status:** ✅  
**Jimmys förklaring:** Visar att något är fel, hover visar vad  
**Vår lösning:** 🎯 Behåller konceptet, förbättrar tooltip-innehållet (se O-K4)

---

### O-K4: Hover-tooltip på varning
**Observation (28/5 tor):**
```
⚠️ Maximalt antal sammanhängande arbetstimmar / 5.25
    Kontor - fyll i anhörigstöd
```
**Status:** ❓  
**Jimmys förklaring:**
- Vad betyder `/ 5.25`? Är det:
  - [ ] Antal timmar man är ÖVER gränsen?
  - [ ] Totalt antal sammanhängande dagar/timmar?
  - [ ] Något annat?
- Vad är gränsen för "maximalt sammanhängande"? (antal dagar eller timmar?)

**Vår lösning:** 🎯 Tydlig text, t.ex.:
> "⚠️ 6 dagar i rad — max är 5 (AML §13). Justera pass 28/5 eller 29/5."

---

### O-K5: Rött hörn på dagcell
**Observation:** Liten röd triangel i övre HÖGER hörn på vissa dagar (t.ex. 4/5, 5/5, 7/5)  
**Status:** ❓  
**Jimmys förklaring:** _(Vad betyder röd triangel jämfört med orange ⚠️?)_  
**Vår lösning:** _(väntar på förklaring)_

---

### O-K6: Flera pass samma dag
**Observation:** Vissa dagar har 2-3 pass staplade, t.ex. 7/5 har tre rader  
**Status:** ✅  
**Jimmys förklaring:** Möten, gruppmöten och arbetspass kan förekomma samma dag  
**Vår lösning:** 🎯 Stöd för flera poster per dag, tydligt visuellt staplade

---

### O-K7: Noteringar på pass
**Observation:** Fritext på vissa dagar: "Kontor", "Bemötande Klockaren", "APT 14:30-15:30", "Sluta tidigare/CN"  
**Status:** ✅ delvis — Skövde-manualen bekräftar att "Anteckning person/dag" är en inbyggd funktion  
**Källa:** Skövde-manualen visar högerklick-meny med "Anteckning person/dag" och "Ta bort anteckning för person/dag"

- `APT` = **Arbetsplatsträff** — troligen korrekt ✅
- "Sluta tidigare/CN" = sannolikt en **Anteckning person/dag** som chef (CN = Chefens initialer?) lade in
- `CN` = ❓ _(Jimmys bekräftelse — chefens initialer eller annan kod?)_

**Vår lösning:** 🎯 Inbyggd anteckningsfunktion per dag och per person. Kategorier: Möte / Utbildning / Avvikelse / Önskemål. Synlig direkt i kalendern.

---

### O-K8: Gruppfilter
**Observation:** "Hemv Norra, Norra" — kan byta grupp via dropdown  
**Status:** ✅  
**Jimmys förklaring:** Hemvården i Töreboda är uppdelad i 6 grupper  
**Vår lösning:** 🎯 Gruppfilter finns från dag 1 i MVP

---

## 📊 SUMMERINGSPANEL (höger sida)

### O-S1: Timbank
**Observation:**
```
Årsarbetstid timbank:     -1.86
Årsarbetstid timbank tot: -4.13
```
**Status:** ❓  
**Jimmys förklaring:**
- Vad är skillnaden mellan "timbank" och "timbank tot"?
- Är -1.86 bra eller dåligt?
- Hur beräknas dessa?

**Vår lösning:** 🎯 Timbank visas som kurva/graf + aktuellt saldo + prognos

---

### O-S2: Heltid vs Avtalade timmar
**Observation:** Heltid 163.86 = Avtalade timmar 163.86 — men Närvarotimmar 154.50  
**Status:** ❓  
**Jimmys förklaring:** _(Vad är skillnaden? Sjukdag 14-15/5 förklarar ca 8h, men stämmer det med 154.50 vs 163.86?)_  
**Vår lösning:** 🎯 Visa differens tydligt med förklaring

---

### O-S3: Larm-sektionen
**Observation:** Fyra identiska larm visas men är avskurna: "Maximalt antal sammanhängande arbet..."  
**Status:** ✅ — detta är ett känt problem med Medvind  
**Jimmys förklaring:** Texten passar inte — man ser aldrig hela larmet i panelen  
**Vår lösning:** 🎯 Full text alltid synlig, klickbar för att hoppa till problemdagen

---

## 📋 FRÅNVAROFLIKEN (Bild 2)

### O-F1: Frånvaro separerad från ledighetsansökan
**Observation:** Frånvaro-fliken visar: Sjukdom 14-15/5, Semester 1-7/6  
Ledighetsansökan-fliken visar: Status "Ansökt" på semestern  
**Status:** ✅  
**Jimmys förklaring:** Registrerad frånvaro och pågående ansökan är separata  
**Vår lösning:** 🎯 Samma uppdelning men integrerat — ansökan syns direkt på kalenderdag

---

### O-F2: Låst-kolonn (hänglås-ikon)
**Observation:** Båda frånvaroposter har låsikon  
**Status:** ❓  
**Jimmys förklaring:** _(Vad innebär låst? Är det godkänt av chef? Exporterat till lönesystem?)_  
**Vår lösning:** _(väntar på förklaring)_

---

### O-F3: "Avvikande kontering"-kolumn
**Observation:** Tom kolumn på frånvarorader  
**Status:** ❓  
**Jimmys förklaring:** _(Vad är avvikande kontering? Används det alls i Töreboda?)_  
**Vår lösning:** _(väntar på förklaring — troligen ej relevant för MVP)_

---

## 🏷️ LEDIGHETSANSÖKAN (Bild 3)

### O-L1: Status-flöde
**Observation:** Status = "Ansökt" — kolumner finns för "Kommentar av me...", "Arbetsledare", "Kommentar av arb..."  
**Status:** ❓  
**Jimmys förklaring:**
- Vilka statusar finns? (Ansökt → Godkänd → Nekad?)
- Vem är "Arbetsledare" i Töreboda-kontexten?
- Används kommentarsfälten i praktiken?

**Vår lösning:** 🎯 Tydligt status-flöde med färger + push-notis när chef svarar

---

### O-L2: "Visa historik"-knapp
**Observation:** Det finns en knapp för att se historiska ansökningar  
**Status:** ✅  
**Jimmys förklaring:** Bra för att se vad man ansökt om tidigare  
**Vår lösning:** 🎯 Historik per medarbetare + per grupp (chef kan se mönster)

---

## 💡 SAMMANFATTNING — Godbitar vi TAR med

| Funktion | Medvinds version | Vår version |
|---|---|---|
| Summeringspanel | Statisk, ett tal | Interaktiv, graf + prognos |
| Larm | Avskurna, passiva | Fulltext, klickbar lösning |
| Varningstriangel | Finns | Finns + bättre tooltip |
| Aktivitetskoder | Kryptiska förkortningar | Fulltext + färg |
| Veckonummer | Finns | Finns |
| Gruppfilter | Finns | Finns |
| Frånvaro/ansökan | Separata flikar | Integrerat i kalender |
| Ledighetsansökan | Tabell med status | Tabell + kalenderintegration + notis |
| Timbank | Två tal utan kontext | Graf + prognos + förklaring |

## ❌ SVAGHETER vi INTE kopierar

1. Trunkerade larm utan åtgärdsförslag
2. Kryptiska koder utan förklaring
3. Ingen "varför"-transparens
4. Passivt system — visar fel men hjälper inte lösa dem
5. Statisk summeringspanel utan kontext

---

## 🆕 LÄRDOMAR FRÅN MEDVIND-MANUALEN (timavlönad)

> Källa: "Medvind - Medarbetare för timavlönad personal i Lidköpings kommun" (2025-10-29)
> Relevant även för Töreboda trots att manualen gäller Lidköping — samma system.

---

### O-M1: Klarmarkering-flödet
**Vad Medvind gör:**
1. Medarbetare **klarmarkerar** sin tid → kalendern byter färg till **brunorange** (Skövde) / **blå** (Lidköping) — kommunen styr färgen
2. Chef **attesterar** → visas **grön** → klart för löneutbetalning

**Deadlines varierar per kommun:**
- Skövde: medarbetare senast **3:e**, chef attesterar senast **5:e**
- Lidköping: medarbetare senast **5:e**

**Jimmys fråga:** ❓ Vad gäller i Töreboda?

**Status:** ✅ Viktigt flöde att kopiera  
**Vår lösning:** 🎯 Tvåstegsflöde — medarbetare bekräftar → chef godkänner → exporteras. Push-notis till chef när medarbetare klarmarkerat. Deadline-påminnelse automatisk.

---

### O-M2: Tillgänglighetsregistrering för vikarier
**Vad Medvind gör:** Timavlönad personal registrerar när de **KAN jobba** (tillgänglighet) och när de **INTE kan jobba**. Utan registrerad tillgänglighet → ingen bokning.

**Status:** ✅ Kritiskt för vikariepoolen  
**Vår lösning:** 🎯 Vikarie-vy i systemet där vikarier registrerar tillgänglighet. Systemet matchar automatiskt lediga pass mot tillgängliga vikarier.

---

### O-M3: Bokning vs Förfrågan (SMS-flödet)
**Vad Medvind gör:**
- **Bokning** = automatisk SMS om tillgänglighet matchar ledigt pass. Inget svar behövs.
- **Förfrågan** = SMS-fråga om pass inte matchar tillgänglighet. Svarar Ja/Nej via SMS.

**Status:** ✅  
**Jimmys fråga:** ❓ Används detta i Töreboda idag? Hur hanteras vikariebokning nu?  
**Vår lösning:** 🎯 Inbyggt notissystem (push/SMS) för vikariebokning. Förfrågan med tidsgräns — svarar ingen inom X minuter → näste vikarie kontaktas automatiskt.

---

### O-M4: Nattpass — visas på rätt datum
**Vad Medvind gör:** Nattpass visas på det datum där **flest timmar ligger** (oftast dagen man slutar). En pil visar att passet startar dagen innan.

**Exempel:** Nattpass 9/10 kl 21:15 → 10/10 kl 06:15 visas på **10/10** med ← pil.

**Status:** ✅ Smart lösning  
**Jimmys fråga:** ❓ Förekommer nattpass i Töreboda hemvård?  
**Vår lösning:** 🎯 Om nattpass finns — samma logik. Pilen är viktig för att undvika förvirring.

---

### O-M5: Färgstatusarna i kalendern (bekräftat)
| Färg | Kod | Betyder | Vem ser det |
|---|---|---|---|
| Grön text/prick | `Ka` | Kan arbeta (tillgänglig) | Timavlönad |
| Svart text/prick | `Ar` | Bokad på arbetspass | Alla |
| Röd text/prick | `Ej` | Ej tillgänglig | Timavlönad |
| Blå bakgrund | — | Klarmarkerat av medarbetare | Alla |
| Grön bakgrund | — | Attesterat av chef | Alla |

**Vår lösning:** 🎯 Ännu tydligare färgsystem med förklarande legend alltid synlig i UI

---

### O-M6: Flera anställningar i samma system
**Vad Medvind gör:** Om en person har flera anställningar måste de hantera varje separat — byta vy, registrera tillgänglighet för varje.

**Status:** ✅ Känt problem  
**Vår lösning:** 🎯 I MVP: en person = en anställning. Men systemet ska inte låsa fast sig så att detta omöjliggörs senare.

---

---

### O-M5: Stämplingar-flik
**Vad Medvind gör:** Det finns en separat flik "Stämplingar" i kalendern — för instämpling/utstämpling (klocka in/ut)

**Status:** ❓  
**Jimmys fråga:** Används stämpling i Töreboda? Klockar personalen in/ut fysiskt?  
**Vår lösning:** _(väntar — om stämpling används är det en hel extra modul)_

---

### O-M6: Löneartsrapportering — ett eget system
**Vad Medvind gör:** Separat flik för att rapportera lönetillägg/-avdrag som inte är standard:
- **Kostavdrag** — äter med brukare i tjänsten (antal dagar/månad)
- **Kilometerersättning** — kör egen bil mellan arbetsplatser under arbetstid (ej hem/jobb)
- Övernattning, fyllnadstid, parkeringsavgift, omkostnadsersättning m.m.

Varje löneart har ett nummer (640 = km-ersättning, 71f = kostavdrag pedagogisk lunch osv.)

**Status:** ❓  
**Jimmys fråga:** Förekommer kostavdrag eller km-ersättning i hemvården Töreboda?  
**Vår lösning:** 🎯 Om det förekommer — bygg ett enkelt formulär. Annars **ej i MVP**.

---

### O-M7: Frånvaroregistrering — viktiga detaljer
**Vad Skövde-manualen visar:**
- Frånvaro ska rapporteras i **sammanhängande perioder** (även över lediga dagar)
- Vid **del av dag** — ange klockslag (t.ex. VAB halvdag)
- VAB kräver barnets personnummer
- Fältet **"F.R."** (Ja/Nej) + "Skicka även första månaden" — gäller troligen föräldraledighet/rehabilitering, bara för löneadmin

**Status:** ✅ för grundflödet, ❓ för F.R.-fältet  
**Jimmys fråga:** Används F.R.-fältet i Töreboda? Vet löneadmin vad det innebär?  
**Vår lösning:** 🎯 Frånvaro i sammanhängande perioder är ett krav. Del-av-dag med klockslag. VAB med personnummer — bygg in från start.

---

---

## 🆕 FRÅN DAGINFORMATION-DIALOGEN OCH ÖNSKESCHEMA (sept 2026)

### O-NY1: Önskeschema — en separat fas bekräftad
**Observation:** September 2026 heter "Önskeschema" i periodfältet (inte bara ett månadsnamn).  
Hela månaden visar "Ledig" (gul) och timbank = **-158.57** = exakt lika med avtalade timmar.

**Vad detta betyder:**
- Det finns en **Önskeschema-fas** där personalen lägger in ÖNSKEMÅL innan schemat fastställs
- Under denna fas är inga pass schemalagda → timbank visar minus = alla avtalade timmar saknas
- När schemat sedan läggs uppfylls timbanken gradvis

**Status:** ✅ Stor insikt — detta är kärnan i schemaprocessen  
**Jimmys fråga:** ❓ Hur lång är Önskeschema-fasen i Töreboda? En vecka? Mer?  
**Vår lösning:** 🎯 **Önskeschema är MVP**. Tydlig fas-indikator i UI: "Önskefas pågår — schema läggs X datum". Personalen lägger önskemål, chefen bygger schema ovanpå.

---

### O-NY2: "Veto" som tidstyp
**Observation:** I "Typ av tid"-dropdown finns alternativet **"Veto"**

**Vad detta innebär:**
- Medarbetaren kan lägga ett formellt **Veto** mot att arbeta en viss tid
- Starkare signal än "Tillgänglig" — ett veto är ett absolut NEJ
- Skyddar t.ex. hämtning av barn, läkartider, fasta åtaganden

**Status:** ✅ Direkt kopplat till vår framtidsidé "ett personligt skyddat önskemål"  
**Jimmys fråga:** ❓ Används Veto i praktiken i Töreboda? Eller ignoreras det?  
**Vår lösning:** 🎯 Vi kallar det "Skyddad tid" och bygger in det i MVP. Personalen anger EN skyddad tid per period. Systemet schemalägger aldrig dit.

---

### O-NY3: Daginformation-dialogen — struktur
**Observation:** När man klickar på en dag öppnas en modal med:
- Knappar: **Dela** / **+ Lägg till** / **Ta bort**
- Kolumner: Start, Slut, Typ av tid, Rast, Uppdrag
- Flik **Grundtid** — visar grundschemat för dagen, med "Återställ till grundtid"-knapp
- Flik **Summering** — summering för dagen

**Vad "Grundtid" + "Återställ" innebär:**
- Det finns ett **Grundschema** (basschema) som är mallen
- Avvikelser görs ovanpå grundschemat
- "Återställ till grundtid" tar bort avvikelsen och återgår till mallen
- Detta är TRANSPARENT — man ser alltid vad grundschemat säger

**Status:** ✅ Excellent designprincip  
**Vår lösning:** 🎯 Vårt system ska alltid visa **vad grundschemat säger** och tydligt markera avvikelser. "Återgå till grundschema" är en knapp på varje dag. Allt som avviker får en förklaring.

---

### O-NY4: "Dela"-knappen på pass
**Observation:** I Daginformation-dialogen finns en **"Dela"**-knapp  
**Status:** ❓  
**Jimmys fråga:** Vad gör Dela? Delar ett pass i två delar (delat pass)?  
**Vår lösning:** _(väntar på förklaring)_

---

### O-NY5: "Uppdrag"-kolumnen i Daginformation
**Observation:** Kolumnen "Uppdrag" finns i dagsdialogens tabell  
**Status:** ❓  
**Jimmys fråga:** Vad är ett "Uppdrag" i hemvårdskontext? Är det brukartilldelning? Specifik insats?  
**Vår lösning:** _(väntar — kan vara relevant för kopplingen till brukarsidan)_

---

### O-NY6: "Lägg till / hantera"-menyn — fullständig lista bekräftad
**Observation (bild 4):** Dropdown visar:
- Frånvaro
- Ledighetsansökan
- Löneartsrapportering
- **Anteckning person/dag**
- **Ta bort anteckning för person/dag**

**Status:** ✅ Bekräftar att anteckningsfunktionen är i menyn, inte på dagcellen  
**Vår lösning:** 🎯 Vi lägger anteckning DIREKT på dagcellen (klickbar ikon) — snabbare än att gå via meny

---

---

## 🆕 FRÅN FULLSTÄNDIG MEDARBETARMANUAL (Medvind Webb)

### O-FM1: Schemafaserna — tre tydliga lägen bekräftade
**Källa:** Sektion 5.2 Diffkorrigering + sektion 9 Passmarknad

Medvind har tre distinkta faser för en schemaperiod:

| Fas | Läge | Vad händer |
|---|---|---|
| 1 | **Önskeläge** | Personalen registrerar önskemål/veto. Ingen attestering möjlig. |
| 2 | **Korrigeringsläge** | Önskeläget stängt. Schemaavvikelser korrigeras mot faktiskt behov. Grafen visar +/- diff. |
| 3 | **Attesterat** | Chef attesterar. Löneunderlag låst. Passmarknad stängd för perioden. |

**Status:** ✅ Kritisk insikt för systemdesign  
**Vår lösning:** 🎯 Dessa tre faser är MVP. Tydlig fas-indikator i UI för alla. Varje fas har egna tillåtna åtgärder — systemet blockerar felaktiga åtgärder per fas.

---

### O-FM2: Passmarknad — passbyte och överlåtelse
**Källa:** Sektion 9

**Status:** ✅ Svar från Jimmy: **Passmarknaden används INTE. Personalen har inte ens tänkt på det.**

Det betyder att passbyten idag sker via **telefon/meddelanden** — ostrukturerat, tidskrävande, ingen historik.

**Vår lösning:** 🎯 Detta är en **stor konkurrensfördel** vi kan ge dem. Vi introducerar passbyten som ett enkelt koncept:
1. Medarbetare trycker "Jag vill byta bort detta pass"
2. Kollegor som är lediga och kan ta passet får en notis
3. Systemet kontrollerar automatiskt att bytet inte bryter regler **innan förfrågan skickas**
4. Chef godkänner med ett klick

**Inte i MVP** men tydlig fas 2-funktion. Formulera som "Bytesmarknad" till personalen — ett nytt verktyg de aldrig haft.

---

### O-FM3: Bemanningsgraf — visar bemanning vs behov
**Källa:** Sektion 4.2

Medvind har en **bemanningsgraf** under kalendern som visar:
- Aktuell bemanning vs resursbehov (Minimalt/Idealt/Maximalt)
- Tidsintervall: 15, 30 eller 60 min
- Klicka på ett tidsintervall → se VEM som jobbar just då
- Filtrera på uppgift, grupp, uppdrag
- Visar tydligt var det är under/överbemannat

**Status:** ✅ Mycket värdefull funktion  
**Jimmys fråga:** ❓ Används denna graf i Töreboda? Är resursbehov inlagt per tid?  
**Vår lösning:** 🎯 En enklare bemanningsöversikt är MVP för chefsvy — "Hur många är inplanerade per timme denna dag?" Interaktiv, klickbar.

---

### O-FM4: Uppgiftsplanering — tilldela specifika arbetsuppgifter
**Källa:** Sektion 7

**Status:** ✅ Svar från Jimmy: **Brukare kopplas INTE till detta schema. Schemat är enbart för personal.**  
Brukartilldelning sköts av LMO (separat system).

**Vår lösning:** 🎯 **Bygg inte uppgiftsplanering kopplat till brukare.** Vårt system är renodlat personalschema. Det är en styrka — inte en brist. Enkelt och fokuserat.

---

### O-FM5: Kalendersynk — exportera schema till extern kalender
**Källa:** Sektion 3.1.2

Medvind kan generera en **prenumerationslänk** för personens schema som synkas till:
- Outlook
- Google Calendar
- iPhone/iOS Kalender
- Android

**Status:** ✅ Populär funktion, hög efterfrågan  
**Jimmys fråga:** ❓ Vill personalen i Töreboda ha detta?  
**Vår lösning:** 🎯 iCal-feed är relativt enkelt att bygga i Next.js. **Hög nytta, låg kostnad** — bygg in tidigt.

---

### O-FM6: Bildinställningar — konfigurerbar kalendervy
**Källa:** Sektion 4.1

Medvind låter varje användare konfigurera sin kalendervy. Tillgängliga inställningar:

| Inställning | Beskrivning |
|---|---|
| Arbetspass | Visar passnamnet |
| Klockslag | Visar alla tidsintervall per dag |
| Per tidtyp | En rad per tidtyp |
| Ramtider | Start/slut oavsett typ |
| Timmar | Summering timmar per dag |
| Stämplingar | Stämplad tid istället för planerad |
| Signaler | **Larm vid brott mot arbetstidsregler** |
| Anteckning | Visar anteckning på dagen |
| Visa ledig | Visar "Ledig" på lediga dagar |
| Visa grundtid/schema | Övre rad = grundtid, nedre = korrigeringar |
| Visa graf | Bemanningsgraf under kalendern |

**Status:** ✅ Bra tanke med konfigurerbarhet  
**Vår lösning:** 🎯 Vi gör **bra defaults** istället för att lägga konfigurering på användaren. "Signaler" (larm) och "Visa grundtid" ska vara PÅ som standard hos oss.

---

### O-FM7: Anteckningar — röd markering bekräftad
**Källa:** Sektion 5.1.4.3

Anteckningar i Medvind:
- Kan skrivas av medarbetare ELLER chef/planerare
- Röd markering på dagen när anteckning finns
- Medarbetare kan bara ta bort sina EGNA anteckningar (chef kan inte ta bort medarbetarens)
- Kan svara på anteckning — fungerar som enkel chatt per dag

**Status:** ✅  
**Vår lösning:** 🎯 Samma logik. Röd/orange indikator på dagcellen. Chef och medarbetare kan skriva, båda ser. Tydlig avsändare ("Chef 2026-05-14" / "Du 2026-05-13").

---

### O-FM8: Veto — bekräftad design + hård gräns
**Källa:** Sektion 5.1.3 + Jimmy bekräftat

Bekräftad veto-funktionalitet:
- Läggs via knappen "Arbetspass" → välj "Veto" ELLER högerklicka på dag
- Kan avse **hela dagen** (00:00-24:00) eller **del av dag** (specifika klockslag)
- Kan endast göras under önskeläge
- **MAX 2 VETO PER PERSON PER MÅNAD** — bekräftat av Jimmy, hård regel

**Status:** ✅  
**Vår lösning:** 🎯 Vi kallar det **"Veto"** (samma ord som personalen känner igen). Enkel UI: klicka på dag → "Lägg veto". Räknare alltid synlig: *"Du har 1 veto kvar denna period"*. Systemet blockerar tredje veto med förklaring.

---

### O-FM9: Dela intervall — bekräftad användning
**Källa:** Sektion 5.1.1.4 + 7.2

"Dela" används för att:
- Rapportera **olika uppgifter** under ett pass (t.ex. hemvård 07-12, kontor 12-15)
- Rapportera **avvikande konto** på del av pass (löneredovisning)

**Status:** ✅  
**Vår lösning:** 🎯 Splitad dagvy är relevant för `An` (annat arbete). Bygg in från start.

---

### O-FM10: Stämpling — eget system
**Källa:** Sektion 8

**Status:** ✅ Svar från Jimmy: **Stämpling används INTE i hemvården Töreboda.**  
**Vår lösning:** 🎯 **Bygg inte stämpling.** Inte nu, inte i framtiden om inte behov uppstår. Sparar massor av komplexitet.

---

### O-FM11: Frånvaro — viktiga regler bekräftade
**Källa:** Sektion 5.3

- Frånvaro räknas **bara för dagar med arbetstid** — ingen paus för lediga dagar mitt i
- Sjukdom och VAB behöver **inte chef-godkännas** — fastställs direkt
- Semester och annan ledighet → **Ledighetsansökan** → chef godkänner
- Del-av-dag: ange start/sluttid för frånvaron

**Status:** ✅ Viktiga regler att implementera rätt  
**Vår lösning:** 🎯 Tydlig distinktion: direktrapporterad frånvaro (sjuk/VAB) vs ansökt ledighet. Sjuk/VAB visas direkt i kalendern utan väntan på godkännande.

---

### O-FM12: Brist/överskott — resursbehov och kontinuitet
**Källa:** Sektion 3.3 + Jimmys svar

**Status:** ✅ Svar från Jimmy: *"Det är ett nödvändigt ont — i bästa av världar vill man ha kontinuitet och att ordinarie personal är på plats."*

**Vad detta egentligen betyder:**
- Resursbehov i hemvård handlar INTE bara om antal kroppar
- Det handlar om att **rätt person** är på plats — brukarna har trygghet i att känna sin personal
- Kontinuitet = samma personal till samma brukare = kvalitet
- Överbemanning med fel person kan vara lika dåligt som underbemanning

**Vår lösning:** 🎯 Två saker i chefsvy:
1. **Kvantitativt**: Tillräckligt antal personal per pass
2. **Kvalitativt**: Markera när ordinarie personal saknas och ersätts av vikarie — chefen ser det direkt

Detta är en **differentierande funktion** — Medvind har ingen kontinuitetsspårning.

---

---

## 🆕 FRÅN DECEMBER 2025-KALENDERN (Jimmy Berndtsson, Hemv Norra)

### O-DEC1: Delad tur bekräftad visuellt — 21/12 sön
**Observation:**
```
21/12 sön:  07:00–13:00 Ar
            15:30–21:30 Ar
```
✅ Exakt som Jimmy beskrev. Två separata Ar-block samma dag med gap 13:00–15:30.

**Notering:** ⚠️ varning finns på 21/12 — troligen pga 20/12 slutade 20:00 och 21/12 börjar 07:00 = exakt 11h vila. Systemet ska varna vid exakt gräns, inte bara vid brott.

---

### O-DEC2: `Ob` bekräftat = Obekväm arbetstid
**Observation:** 12/12 fre: 08:30–14:00 Ob + 14:00–16:00 Ob  
**Status:** ✅ Ob = OB-tillägg markeras som tidstyp på passet. Inte ett eget pass — en markering på tid som ger OB-ersättning.  
**Vår lösning:** 🎯 OB-beräkning sker automatiskt baserat på tidpunkt — ingen manuell `Ob`-markering behövs. Systemet vet att lördag/söndag + kvällar = OB.

---

### O-DEC3: `Tp` = Föräldraledighet
**Observation:** 8/12 mån: 15:00–16:00 Tp och 9/12 tis: 15:00–16:00 Tp  
**Status:** ✅ Bekräftat av Jimmy — `Tp` = Föräldraledighet (ologisk förkortning, men det är vad det är)  
**Vår lösning:** 🎯 Vi kallar det "Föräldraledighet" i klartext. Inga kryptiska förkortningar.

---

### O-DEC4: Obokad tur till annan grupp — synlig i kalendern
**Observation:** 8/12 mån visar: "Hemv Östra, Östra" — Jimmy jobbade i en annan grupp denna dag  
**Status:** ✅ Bekräftar hur obokade turer fungerar i praktiken — person från Norra skickas till Östra vid behov  
**Vår lösning:** 🎯 I bemanningsvyn: tydlig indikator när personal jobbar utanför sin ordinarie grupp. Spåra för statistik — hur ofta sker detta?

---

### O-DEC5: Personliga anteckningar som schemaverktyg
**Observation:** Flera anteckningar direkt i kalendern:
- *"Kan bara jobba dag"* — 26/12, personlig begränsning
- *"Fick jobba över en halvtim..."* — 7/12, övertidsnotering
- *"Kommer senare, krångel m..."* — 16/12, avvikelse med förklaring
- *"Anhörigtid, fyll i lappar för a..."* — 30/12, anhörigvård?
- *"Kontor + planering"* — återkommande på flera dagar

**Status:** ✅ Anteckningar används aktivt som kommunikationsverktyg, inte bara dokumentation  
**Vår lösning:** 🎯 Anteckningar är MVP. "Kan bara jobba dag" är en naturlig språklig veto — vi stödjer det som en riktig begränsning, inte bara fritext.

---

### O-DEC6: Larm — "Lediga dagar per vecka"
**Observation:** Larm-sektionen visar "Lediga dagar per vecka" — en ny larmtyp  
**Status:** ✅ Det finns alltså en regel om minsta antal lediga dagar per vecka (troligen kopplat till 36h veckovila)  
**Vår lösning:** 🎯 Bygga in kontroll: systemet räknar lediga dagar per vecka och larmar om det är för få.

---

### O-DEC7: Dygnsvila-larm = "Arbete och dygnsvila ej alternerande"
**Observation:** Larm: *"Dygnsvila 11tim 2023 bryt 18@2025-21"*  
**Status:** ✅ Bekräftat av Jimmy: **"Arbete och dygnsvila ej alternerande"**

**Vad det betyder:**
Arbete och vila måste alterera korrekt — man kan inte ha:
```
Arbete → för kort vila → Arbete igen
```
utan att bryta regeln. Gapet i en **delad tur** (2,5h) räknas inte som dygnsvila.
Systemet flaggar alltså när mönstret arbete→vila→arbete inte respekterar 11h-kravet.

**Varför triggas det på 21/12:**
- Delad tur: 07:00–13:00 + 15:30–21:30
- Gapet är bara 2,5h — inte dygnsvila
- Medvind varnar för "ej alternerande" mönster

**Vår lösning:** 🎯 Tydlig varning: *"⚠️ Delad tur 21/12 — arbete och vila alternerar inte korrekt (gap 2,5h). Kontrollera att detta är en godkänd delad tur."* Visa exakt vilken regel och varför.

---

### O-DEC8: Timbank 0.64 — nästan perfekt balans
**Observation:** Årsarbetstid timbank: +0.64h för december  
**Status:** ✅ Mycket bra balans — i princip noll  
**Vår lösning:** 🎯 Det är målet: timbank nära noll. Systemet ska visa hur nära noll varje persons timbank är, och vad som krävs för att nå dit.

---

### O-DEC9: Gröna dagar = attesterade
**Observation:** De flesta arbetsdagar i december har grön bakgrund. Jämfört med maj-kalendern (orange) är detta annorlunda.  
**Status:** ✅ Troligen = attesterade dagar (chef har godkänt). December är historisk period.  
**Vår lösning:** 🎯 Tydlig färgkodning: Ej klarmarkerad → Klarmarkerad (blå) → Attesterad (grön)

---

### O-DEC10: `Me` = Möte (bekräftat?)
**Observation:** 11/12 tor: "Möte TG" som anteckning, samma dag har An-block  
**Status:** ❓ Möte verkar hanteras som anteckning + `An` (Annat arbete), inte som separat kod `Me`  
**Jimmys fråga:** Är `Me` = Möte, eller används `An` + anteckning för möten?

---

## 📌 NYA DESIGNBESLUT baserade på manualerna

**BYGG (MVP):**
1. **Klarmarkering** — medarbetare bekräftar → chef attesterar → löneunderlag klart
2. **Tre schemafaser** — Önskeläge → Korrigeringsläge → Attesterat, tydlig fas-indikator
3. **Tillgänglighetsregistrering för vikarier** — separat vy, förutsättning för vikariebokning
4. **Grundschema + avvikelser** — visa alltid grundtid, korrigeringar på separat rad
5. **Skyddad tid (Veto)** — hel dag eller tidsintervall, bara aktiv i önskeläge
6. **Frånvaro** — sammanhängande perioder, del-av-dag, sjuk/VAB direkt, semester via ansökan
7. **Anteckning per dag** — direkt på dagcellen, chef + medarbetare, tydlig avsändare
8. **Bemanningsöversikt (kvantitativ + kontinuitet)** — antal personal + markera vikarieersättning

**BYGG INTE (bekräftat av Jimmy):**
- ~~Stämpling~~ — används inte i hemvård Töreboda
- ~~Brukarkoppling~~ — brukare hanteras i LMO, ingår inte i personalschema
- ~~Uppgiftsplanering~~ — inte relevant för denna kontext

**BYGG SENARE (fas 2):**
- **Passmarknad/Bytesmarknad** — notisbaserad, mobilanpassad, automatisk regelkontroll
- **Kalendersynk (iCal)** — prenumerationslänk till Outlook/Google/iPhone
- **SMS/push för vikariebokning** — automatisk notis vid ledigt pass
- **Löneartsrapportering** — km-ersättning, kostavdrag (fråga Jimmy om det behövs)
