# Verksamhetskunskap - Töreboda Hemvård

> Detta dokument är ett LEVANDE arbetsdokument. Jimmy fyller på svar löpande, antingen direkt i denna fil eller genom att be Claude Code uppdatera den.
>
> Format: Fråga → Svar → Källa/Anteckningar
>
> Källor kan vara:
> - "Erfarenhet" (Jimmy vet från sitt arbete)
> - "Samordnare [namn]" (frågat någon)
> - "Personec screenshot [filnamn]" (sett i system)
> - "Kollektivavtal [referens]" (juridisk källa)
> - "Antagande" (gissning som behöver verifieras)

---

## 🕐 KATEGORI 1: Arbetstider och pass

### F1.1: Vilka är alla passtyper som förekommer?
**Status:** ✅ delvis — dagpass bekräftade, kväll/natt behöver mer info

**Dagpass — bekräftade starttider:**
| Starttid | Sluttid (möjliga) | Notering |
|---|---|---|
| **6:45** | 14:00 / 15:30 / 16:00 | Alltid rapport från nattpersonal. **REGEL: exakt 1 person per grupp måste börja 6:45 varje dag.** |
| **7:00** | 14:00 / 15:30 / 16:00 | Ordinarie dagstart |

**Roll: Dagansvarig**
- Tjänst som alltid jobbar dagturer (6:45 eller 7:00-start)
- Dessa personer är "låsta" till dag — schemaläggaren ska aldrig lägga dem på kväll

**Hård schemaregel:**
> En personal per grupp SKA alltid börja 6:45 för att ta nattrapporten.
> Systemet ska flagga om ingen är inplanerad 6:45 i en grupp.

**Bekräftat av Jimmy:**
- **1 dagansvarig per grupp** — 6 grupper = 6 dagansvariga totalt
- **Ingen kvällsansvarig**
- **Nattrapporten tar alltid exakt 15 min** — 6:45 → 7:00, sedan ordinarie arbete

**Konsekvenser för systemet:**
- Dagansvarig är en kritisk singelpunkt — om hen är sjuk måste någon täcka 6:45
- Troligt scenario: obokad tur skickas in för att täcka nattrapporten vid sjukdom
- Systemet ska varna direkt om dagansvarig är frånvarande och ingen täcker 6:45

**Bekräftade pass:**
| Pass | Starttid | Sluttid | Notering |
|---|---|---|---|
| Dag tidig | 06:45 | 14:00 / 15:30 / 16:00 | Nattrapporten. 1 per grupp obligatorisk. |
| Dag | 07:00 | 14:00 / 15:30 / 16:00 | Ordinarie dag |
| Kväll kort | 13:45 | 20:00 | Bekräftat ✅ |
| Kväll lång | 13:45 | 21:30 | Bekräftat ✅ |
| Natt | ❓ | ❓ | Jimmy återkommer |

**Viktig princip:** Dessa tider är **inte skrivna i sten**. De är dokumenterade nulägestider från verksamheten, inte hårdkodade systemregler. Verksamheten kan ändra passtider när behovet ändras, och systemet måste kunna följa med utan kodändring.

**Konsekvens för systemet:**
- Passtyper och start-/sluttider ska vara konfigurerbara per grupp
- Historiska scheman ska behålla de tider som gällde då
- Nya tider ska kunna börja gälla från ett visst datum
- Regelmotorn ska räkna på faktiska passintervall, inte på antaganden som "kväll slutar alltid 20:00"

**Kvällsturernas flexibilitet:**
- En 20:00-tur kan behöva ändras till 21:30 med kort varsel om vårdtyngden ökar
- Exempel: en brukare blir palliativ och behöver besök/särskilt mycket tid på kvällen
- Då måste verksamheten ställa om, och framtida 20:00-turer kan behöva förlängas till 21:30
- Detta är inte ett nytt passmönster för skojs skull, utan en reaktion på faktisk vårdtyngd

**Kvar att bekräfta:**
- Nattpass: ❓ Jimmy återkommer
- Finns mellanpass eller kortare pass (4h, 6h)?

---

### F1.2: Är passtiderna olika på helger?
**Status:** ❓ Ej besvarad

**Svar:** _(fyll i här)_

---

### F1.6: Överlappstiden 14:00–16:00 — vad händer?
**Status:** ✅ Bekräftat av Jimmy

**Situationen:**
- Dagpersonal slutar ofta **16:00**
- Kvällspersonal börjar ofta **14:00 eller 14:45**
- → Overlap ca **14:00–16:00** med fler personal än vad direktvård kräver

**Hur överlappstiden används:**
| Aktivitet | Tidstyp i Medvind | Vem |
|---|---|---|
| Kontorstid / administration | `An` (Annat arbete) | Ordinarie dagpersonal |
| Planeringstid i LMO | `An` (Annat arbete) | Planerare |
| Dagansvarig-uppgifter | `An` eller eget | Dagansvarig |

**Konsekvenser för systemet:**
- Överlapp 14:00–16:00 är **avsiktlig och strukturell** — inte slöseri
- Bemanningsgraf ska INTE flagga detta som överbemanning
- Systemet behöver förstå skillnaden: "för många på brukarvård" vs "rätt antal, varav X är på kontorstid"
- `An` (Annat arbete) är den primära tidstypen för denna tid
- Dela intervall-funktionen (split pass) är relevant: 07:00–14:00 Arbete + 14:00–16:00 Annat arbete

---

### F1.3: Hur lång är rasten på olika passtyper?
**Status:** ❓ Ej besvarad

**Underfrågor:**
- Räknas rasten som arbetstid eller inte?
- Är rasten tvingande eller flexibel?

**Svar:** _(fyll i här)_

---

### F1.4: Vad är dygnsbrytet?
**Status:** ❓ Ej besvarad

Dygnsbryt = när en ny 24h-period börjar räknas för dygnsvilan.

**Svar:** _(fyll i här)_

---

### F1.5: Förekommer delade pass?
**Status:** ✅ Bekräftat — kallas "Delad tur"

**Struktur:**
```
07:00 ──── arbete ──── 13:00
                         │
                    rast / gap
                    (2,5 timmar)
                         │
                       15:30 ──── arbete ──── 20:00 eller 21:30
```

**Används:** Ibland, när verksamheten behöver det — inte ett standardpass

**Arbetstid:**
- Segment 1: 6h (07:00–13:00)
- Segment 2: 4,5h (15:30–20:00) eller 6h (15:30–21:30)
- Totalt arbetat: 10,5h eller 12h
- Gapet 13:00–15:30 räknas INTE som arbetstid

**Konsekvenser för systemet:**
- Dygnsvila måste räknas från **sista sluttiden** — slutar 21:30 → nästa dag ej före 08:30
- Systemet måste stödja **två separata tidsblock per dag** (Dela intervall-funktionen)
- Tidstyp: troligen `Ar` (07–13) + `Ar` (15:30–20/21:30)
- Systemet ska varna om delad tur + tidigt nästa dag bryter 11h-regeln

**Kvar att förstå:**
- Är det frivilligt eller kan chef beordra delad tur?
- Ger delad tur extra ersättning (OB eller annan kompensation för gapet)?

---

## 📅 KATEGORI 2: Helger och rotationer

### F2.1: Är det varannan helg som gäller alla?
**Status:** ✅ Bekräftat

**Regel:** Varje person ska ha **exakt 2 helger per månad** i schemat.
- Ingen fast A/B-rotation — det är **helt individuellt**
- Under önskeschema kan man byta helger fritt
- Man KAN jobba 2 helger i rad (och få 2 helger ledigt i rad nästa period)
- Systemet ska kontrollera: har denna person 2 helger denna månad?

**Hård regel:** Färre än 2 helger = fel. Fler än 2 helger = möjligt men kräver aktivt val.

---

### F2.2: Vad räknas som helg?
**Status:** ❓ Ej besvarad

- Lördag + söndag?
- Inkluderar fredag kväll?
- Hur hanteras "klämdagar"?

**Svar:** _(fyll i här)_

---

### F2.3: Hur fungerar helggrupperna A/B?
**Status:** ✅ Bekräftat — finns INTE

Ingen A/B-gruppering. Helgrotationen är helt individuell per person.

---

### F2.4: Hur hanteras röda dagar?
**Status:** ❓ Ej besvarad

**Underfrågor:**
- Räknas röda dagar som helger?
- Annan ersättning?
- Annan bemanning?

**Svar:** _(fyll i här)_

---

### F2.5: Storhelger (jul, midsommar, nyår)?
**Status:** ❓ Ej besvarad

**Svar:** _(fyll i här)_

---

## ⏱️ KATEGORI 3: Saldo och timmar

### F3.1: Hur beräknas målmånadstimmar?
**Status:** ❓ Ej besvarad

Är det t.ex. 75% × 165h = 124h/månad?

**Svar:** _(fyll i här)_

---

### F3.2: Saldo per månad eller schemaperiod?
**Status:** ❓ Ej besvarad

**Svar:** _(fyll i här)_

---

### F3.3: "Hellre minus än plus" - hur officiell är regeln?
**Status:** ❓ Ej besvarad

**Detalj från Jimmy:** Om arbetsgivaren ser minustid har de "lite hållhake" - men det är inte 100% klart om det är formell policy eller informell konvention.

**Svar:** _(fyll i här)_

---

### F3.4: Vad händer med minustid när månaden tar slut?
**Status:** ❓ Ej besvarad

**Svar:** _(fyll i här)_

---

### F3.5: Vad händer med plustid?
**Status:** ❓ Ej besvarad

**Svar:** _(fyll i här)_

---

## 👥 KATEGORI 4: Personal och tjänstgöringsgrad

### F4.1: Vilka tjänstgöringsgrader förekommer?
**Status:** ✅ Bekräftat

- **Alla former förekommer** — 100%, 75%, 50% och troligen däremellan
- Sätts av: chef (normalt) eller läkare (vid sjukskrivning/medicinsk anpassning)
- Läkarsatt % = särskilt fall — en medicinsk begränsning som schemat måste respektera

**Konsekvens för systemet:**
- Varje person har en % som styr hur många timmar de ska ha per månad
- Läkarsatt % kan ändras mitt i en period och måste uppdateras omedelbart
- Systemet ska aldrig schemalägga fler timmar än vad personens % tillåter

---

### F4.2: Fast bemanning vs vikariepool?
**Status:** ✅ delvis

**Roller bekräftade:**

| Roll | Antal | Ansvar | Ser vilka grupper | När aktiv |
|---|---|---|---|---|
| **Medarbetare** | ~66 st | Eget schema, önskemål, frånvaro | Bara sig själv | Alltid |
| **Planerare** | 1–2 per grupp (~6–12 tot) | Strukturera dagen för varje anställd, planera brukarbesök. Kan ha helgansvarig-roll. | Sin grupp | Alltid |
| **Helgansvarig** | 1 per helg | Bemanningsansvar helg + röda dagar. Hämtas ur planerare-poolen. | Alla grupper | Helger + röda dagar |
| **Samordnare** | 2 st | Daglig bemanning vardagar — sjuktäckning, vikariebokning, obokade turer | Alla grupper | Vardagar (ej röda dagar) |
| **Chef** | 3 st | Schemaläggning, godkänna ledighet, attestera | Sina grupper (konfigurerbart) | Alltid |

**Bemanningsansvar per tid:**
- **Vardag / ej röd dag** → Samordnare (veckovis rotation mellan de 2)
- **Helg + röd dag** → Helgansvarig (1 person ur planerare-poolen)

**Om planerare — bekräftat:**
- Varje grupp har 1–2 planerare
- Planerar i **LMO (Lifecare Mobil Omsorg)** — separat system, UTANFÖR vårt scope
- LMO innehåller: alla brukare, journalanteckningar, medicinsignering, teammeddelanden, genomförandeplaner
- Potentiell framtida integration med LMO — men inte nu
- Är ofta den som har helgansvarig-rollen (rotation)

**Viktig ekonomisk/verksamhetsmässig kontext:**
- Hemvården får tid från **biståndshandläggare** och **sjuksköterska**
- Den tiden fördelas sedan ut till varje brukare
- Detta är grunden för hur verksamheten får pengar och hur mycket arbete som faktiskt finns att utföra
- Schema-/bemanningssystemet ska därför förstå bemanningsbehov på gruppnivå, även om brukarplaneringen fortsatt ligger i LMO

**Helgansvarig — rotation med problem:**
- Utses via rotation
- Alla planerare ingår i rotationen
- ⚠️ Inte alla vill vara helgansvarig — stort ansvar
- Konsekvens: rättviseaspekt viktig — systemet ska visa vem som haft helgansvar senast
- Möjlig funktion: "Skyddad period" — kan en planerare markera att de inte kan ha helgansvar en viss helg?

**Systemgränser bekräftade:**
| System | Innehåll | Integration |
|---|---|---|
| **Vårt system** | Personalschema, bemanning, önskemål | — |
| **LMO** | Brukare, journaler, medicin, genomförandeplaner | Utanför scope (framtid möjlig) |
| **Personec** | Lön, anställningsdata | Export av löneunderlag |
| **Medvind** | Nuvarande schema/bemanning (ersätts) | — |

**Konsekvenser för systemet:**
- Samordnare är **primär användare av bemanningsvyn** — inte chefen
- Systemet behöver en "Veckans bemanningsansvarig"-markering
- Samordnaren ser alla 6 grupper samtidigt — behöver en **samlad bemanningsöversikt**
- Larm om 6:45-slot saknas ska gå till bemanningsansvarig samordnare, inte chefen
- Systemet ska i normalfallet hålla ordinarie personal i sin egen grupp, men kunna visa och hantera när sjukfrånvaro/VAB kräver lån mellan grupper eller vikarie

**Kommunikation vid bemanning:**
- Norra, Östra, Centrum 1, Centrum 2, Moholm → **samma lokal** — samordnaren kan gå till gruppernas kontor fysiskt
- Centrum 3 → **separat lokal** — samordnaren ringer

**Samordnarens systembehörighet (bekräftat):**
- Har utökad behörighet i Medvind/Personec jämfört med ordinarie medarbetare
- Kan **ändra schema direkt** — behöver inte gå via chef
- Bokar **vikarier** vid sjukdom och VAB

**Konsekvens för systemet:**
- Samordnare = egen roll med skrivbehörighet på alla grupper
- Vikariebokning är en kärnfunktion för samordnarens vy
- Centrum 3 kan behöva push-notis/SMS eftersom de inte sitter i samma hus

---

### F4.3: Totalt antal personal i Töreboda hemvård?
**Status:** ✅ Besvarad

**Grupper och storlek:**
| Grupp | Ca antal personal |
|---|---|
| Norra | 8–14 |
| Östra | 8–14 |
| Centrum 1 | 8–14 |
| Centrum 2 | 8–14 |
| Centrum 3 | 8–14 |
| Moholm | 8–14 |

**Totalt:** ~48–84 personer (6 grupper × 8–14 pers)

**Notering:** Tidigare antagande "Södra" stämmer inte — rätt namn är Norra, Östra, Centrum 1-3, Moholm.

**Underfråga kvar:** Hur många heltid vs deltid per grupp?

---

### F4.4: Är det 8 personer per pass i alla grupper?
**Status:** ✅ Delvis besvarad

**Svar från Jimmy:** Nej. Bemanningsbehovet varierar per grupp, pass och ibland veckodag.

Exempel:
- Vissa grupper kan kräva **3 personal på morgonen** och **2 på kvällen**
- Andra grupper kan ha andra nivåer
- Vissa dagar har extra belastning, t.ex. **extra duschar eller omläggningar på torsdagar**
- Då måste gruppen vara fulltalig, t.ex. 3 på morgonen
- På en lugnare fredag kan samma grupp kanske klara sig på 2 och skicka över 2 besök till annan grupp

**Konsekvens för systemet:**
- Bemanningsbehov kan inte vara ett fast tal per grupp
- Systemet behöver en behovsmall per grupp, dagtyp och pass/tidsintervall
- Behovsmallen bör på sikt kunna baseras på summerad brukartid från biståndshandläggare och sjuksköterska, utan att systemet blir ett fullständigt LMO/brukarplaneringssystem
- Systemet behöver kunna markera särskilda belastningsdagar, t.ex. "torsdag morgon kräver full bemanning"
- Bemanningsöversikten ska visa både planerad bemanning och krav: t.ex. `2/3` = en person saknas
- Schemat är inte godkänt bara för att lagreglerna följs; det måste också täcka verksamhetens faktiska behov

**Kvar att kartlägga:**
- Exakt minimibemanning per grupp, pass och veckodag
- Vilka återkommande arbetsmoment höjer behovet, t.ex. duschdagar, omläggningar, APT, läkemedelsrundor
- När kan besök flyttas till annan grupp, och vem beslutar det?
- Hur ofta ändras beviljad tid/HSL-tid, och vem matar in eller importerar den?

---

### F4.6: Hur viktigt är det att ordinarie personal stannar i sin grupp?
**Status:** ✅ Bekräftat

**Svar från Jimmy:** I regel försöker man hålla ordinarie personal till respektive grupp, och detta hålls ofta. Sjukfrånvaro, vård av barn och andra akuta avvikelser kan rubba detta.

**Regeltyp:** Mjuk regel / stark preferens.

**Tolkning:**
- Grundläget är att personal jobbar i sin ordinarie grupp
- Byte/lån mellan grupper ska inte ske i onödan
- Vid sjukdom, VAB eller bemanningsbrist kan samordnaren behöva flytta personal mellan grupper
- Sådana avvikelser ska vara synliga, inte dolda i schemat

**Konsekvens för systemet:**
- Varje medarbetare behöver ha en `ordinarie_grupp`
- Schemaförslag ska försöka maximera kontinuitet i ordinarie grupp
- Bemanningsvyn ska markera när någon jobbar utanför sin ordinarie grupp
- Systemet bör kunna förklara varför: t.ex. "Flyttad från Norra till Östra pga sjukfrånvaro och underskott 1 person på morgonpass"
- Statistik över lån mellan grupper kan bli viktigt: vilka grupper lånar ofta ut/in personal?

---

### F4.7: Ska chef/samordnare kunna justera bemanningskrav manuellt?
**Status:** 💡 Framtidsidé / designinsikt

**Idé från Jimmy:** I framtiden kan systemet ha ett enkelt reglage där chef eller samordnare justerar hur tungt bemanningskravet är för en grupp/dag.

**Exempel på reglage:**
- Låg belastning: gruppen klarar sig med miniminivå, t.ex. 2 på morgon
- Normal belastning: standardbemanning
- Hög belastning: fulltaligt krav, t.ex. 3 på morgon pga duschar/omläggningar

**Viktig distinktion:**
Detta ska inte vara ett godtyckligt "tyckande"-reglage. Reglaget bör spegla verklig belastning:
- Beviljad tid från biståndshandläggare
- HSL-/sjuksköterskeinsatser
- Återkommande duschdagar
- Omläggningar
- Tillfälliga vårdtyngdsförändringar
- Palliativ vård eller andra akuta förändringar som kräver senare kvällsbesök

**Behörighet/tänk:**
- Chef kan tänka mer på budget, ansvar och formellt godkännande
- Samordnare kan tänka mer på dagens praktiska genomförbarhet
- Därför kan samma reglage behöva visa både ekonomisk effekt och praktiskt bemanningsläge

**Konsekvens för systemet:**
- Bemanningskrav bör vara redigerbara per grupp/dag/tidsintervall
- Ändringar ska loggas: vem ändrade, när och varför
- Systemet ska visa konsekvensen direkt: t.ex. "Högt krav torsdag morgon: behöver 3, planerat 2, underskott 1"
- Systemet ska kunna föreslå passändringar framåt, t.ex. "Byt kommande kvällstur från 20:00 till 21:30 pga palliativt behov"
- I MVP kan detta vara manuellt; senare kan det kopplas till importerad/summerad tid från LMO eller annat underlag

---

### F4.5: Hur lämnas önskemål idag?
**Status:** ❓ Ej besvarad

**Underfrågor:**
- Direkt i Personec?
- Papper?
- Mejl?
- Via samordnare?

**Svar:** _(fyll i här)_

---

## 🚨 KATEGORI 5: Undantag och flexibilitet

### F5.1: Lokala undantag från 11h dygnsvila?
**Status:** ❓ Ej besvarad

SKR har möjliggjort vissa undantag för vård/omsorg vid kritisk bemanning.

**Svar:** _(fyll i här)_

---

### F5.2: Vad händer vid sjukfrånvaro mitt i månaden?
**Status:** ❓ Ej besvarad

**Svar:** _(fyll i här)_

---

### F5.6: Hur hanteras ändrad vårdtyngd mitt i en schemaperiod?
**Status:** ✅ Delvis besvarad

**Svar från Jimmy:** Verksamheten kan behöva ställa om direkt. Exempel: en brukare blir palliativ och behöver besök sent på kvällen eller tar mycket mer tid än tidigare. Då kan framtida kvällsturer som slutar 20:00 behöva ändras till 21:30.

**Tolkning:**
- Schemat är inte statiskt efter att månaden lagts
- Behovet kan ändras på grund av palliativ vård, större HSL-insatser, omläggningar eller annan ökad vårdtyngd
- Ändringen påverkar inte bara dagens bemanning utan också framtida turer

**Konsekvens för systemet:**
- Systemet behöver stöd för omplanering framåt i perioden
- En ändrad sluttid från 20:00 till 21:30 måste trigga ny kontroll av dygnsvila nästa dag
- Om personen börjar 06:45/07:00 dagen efter kan 21:30-slut bryta 11h-regeln
- Systemet ska visa vilka efterföljande pass som påverkas innan ändringen godkänns
- Ändringen bör loggas med orsak, t.ex. "palliativt behov", "ökad HSL-tid", "extra kvällsbesök"

---

### F5.3: Kan personal vägra ett tilldelat pass?
**Status:** ❓ Ej besvarad

**Svar:** _(fyll i här)_

---

### F5.4: Övertid - frivillig eller beordrad? Kompensation?
**Status:** ❓ Ej besvarad

**Svar:** _(fyll i här)_

---

### F5.5: "Skyddade tider" för personal?
**Status:** ❓ Ej besvarad

Exempel: barnomsorg-hämtning, läkartider, etc.

**Svar:** _(fyll i här)_

---

## 📋 KATEGORI 6: Processen idag

### F6.0: Varför bygger vi detta? — Kostnadsberäkning
**Status:** ✅ Bekräftat av Jimmy

**Schemaläggningsprocessen idag:**
- **2 personer per grupp** sitter och lägger schema
- **6 grupper** = 12 personer totalt
- **1 hel dag** per person = 8 timmar
- **Varje månad** = 12 gånger per år

**Kostnadskalkyl:**
| Post | Beräkning | Summa |
|---|---|---|
| Arbetstid | 12 pers × 8h × 12 mån | **1 152 h/år** |
| Lönekostnad (ink. arbetsgivarareavgifter ~250 kr/h) | 1 152 h × 250 kr | **~288 000 kr/år** |
| Produktionsbortfall (de gör inte vård denna dag) | Inkluderat ovan | — |

**Målet med systemet:**
> Reducera 1 hel schemaläggningsdag per grupp till **< 2 timmar granskning**
> Systemet genererar förslag → personal granskar och justerar → klart

**Potentiell besparing:**
- Om vi sparar 6 av 8 timmar per grupp per månad:
- 12 pers × 6h × 12 mån × 250 kr = **~216 000 kr/år** i direkt lönebesparing
- Plus: bättre scheman → mindre överbemanning → ytterligare besparing

### F6.1: Schemaperiodens längd + grundschema
**Status:** ✅ Bekräftat

- Schema läggs **månadsvis**
- Byggs **från scratch** varje månad — inget fast rotationsschema
- Följer i praktiken varannan helg-principen men det är inte hårt inkodat
- 2 personer per grupp × 1 hel dag × 6 grupper = 12 dagars arbete per månad

**Konsekvens:** Systemet behöver inte hantera rullande grundschema. Varje månad är ett nytt problem att lösa — men med personens historik som input.

---

### F6.2: När får personalen schemat?
**Status:** ❓ Ej besvarad

**Svar:** _(fyll i här)_

---

### F6.3: Hur ser önskemålsinlämning ut idag?
**Status:** ✅ Bekräftat

**Önskeschema — hur det fungerar:**
- Personalen skriver in de **pass de VILL ha** — väljer från gruppens standardpass
- Varje grupp har sina **egna standardpass-tider** baserade på brukarnas behov
  - Exempel: Norra börjar inte 7:30 — brukarna kräver 6:45 eller 7:00
  - En annan grupp kanske har 7:30 som standard
- Vill man INTE ha ett specifikt pass → lägger man **VETO**

**VETO-regeln — hård gräns:**
> Varje person får lägga **MAX 2 VETO per månad**
> Systemet ska räkna och blockera ett tredje veto

**Konsekvenser för systemet:**
- Standardpass lagras **per grupp** — inte globalt
- Standardpass är konfiguration och kan ändras över tid utifrån verksamhetens behov
- Önskeschema = kombination av "vill ha"-val + max 2 veton
- Veto-räknare per person per period är obligatorisk
- Systemet visar: "Du har X veto kvar denna period (max 2)"

---

### F6.4: Vilket system registreras schemat i?
**Status:** ✅ Personec

**Anteckningar:** Personec används. Skärmdumpar från Personec kommer dropas i `docs/personec/` (med namn maskerade).

---

### F6.5: Vad är överbemanningens orsak?
**Status:** ✅ Besvarad

**Svar från Jimmy:** Överbemanning genererar **obokade turer** — personal som är schemalagd men inte tilldelad en specifik tur/grupp. Dessa används som **flexibel buffert** för att täcka upp vid:
- Sjukfrånvaro i en grupp
- Högt tryck (fler brukarbehov) i en grupp

**Konsekvens för systemet:**
- Överbemanning är INTE slöseri — det är medveten buffertkapacitet
- "Obokat arbete" i Medvind är kopplingen till detta (tidstyp för pass utan specifik tur)
- Frågan är inte "ta bort överbemanning" utan "optimera MÄNGDEN buffert"
- Systemet ska kunna visa: hur många obokade turer finns idag? Var finns behovet just nu?

**Kvar att förstå:** Hur bestäms buffertens storlek idag? Erfarenhet/känsla eller en regel?

---

## 🏢 KATEGORI 7: Lokal kontext - Töreboda

### F7.1: Vilket fackförbund?
**Status:** ❓ Ej besvarad

**Svar:** _(fyll i här)_

---

### F7.2: Lokala kollektivavtal i Töreboda?
**Status:** ❓ Ej besvarad

**Svar:** _(fyll i här)_

---

### F7.3: Beslutsfattare för nytt system?
**Status:** ✅ delvis

**Antal chefer:** 3 stycken  
**Gruppfördelning:** Konfigurerbar — ska INTE hårdkodas i systemet

**Designbeslut (Jimmy explicit):** Kopplingen chef→grupp måste kunna ändras via admingränssnitt utan kod-ändringar. Chefer slutar, omorganiseringar sker, grupper slås ihop.

**Konsekvens för systemet:**
- Chef tilldelas grupper i databasen, inte i koden
- En chef ser bara sina tilldelade grupper
- Admin (enhetschef?) kan flytta grupper mellan chefer
- Systemet frågar aldrig "vilken grupp tillhör chef X?" — det slår upp svaret i databasen

---

### F7.4: Tidigare AI/digitalisering i Töreboda?
**Status:** ❓ Ej besvarad

**Svar:** _(fyll i här)_

---

### F7.5: Pågående diskussioner om förändring/inköp?
**Status:** ✅ Demo bokad

**Anteckningar:** Demo med extern leverantör om ca 2 veckor. Jimmy är inbjuden av sin chef för att utvärdera ur AI-perspektiv.

---

## ⚖️ KATEGORI 8: Rättviseaspekter

### F8.1: Finns rättvise-tracking idag?
**Status:** ❓ Ej besvarad

**Svar:** _(fyll i här)_

---

### F8.2: Hur hanteras semesterperioder?
**Status:** ❓ Ej besvarad

**Svar:** _(fyll i här)_

---

### F8.3: Möten, utbildning, kompetensutveckling?
**Status:** ✅ delvis bekräftat

**APT — Arbetsplatsträff:**
- Frekvens: **1 gång per månad**
- Tid: **13:45–16:00**
- Deltagare: hela gruppen + chefen
- Tidstyp i Medvind: `An` (Annat arbete) + anteckning "APT"

**Varför 13:45–16:00 är smart:**
```
Dagpersonal (slutar 16:00) ──────────────► är kvar
Kvällspersonal (börjar 13:45) ───────────► precis inne
                              └── APT 13:45-16:00 ──┘
```
Alla kan delta utan extra schemaläggning — naturlig overlap utnyttjas.

**Konsekvens för systemet:**
- APT ska synas som en återkommande händelse i schemaläggningsvyn
- Systemet ska inte schemalägga ledig dag för personal på APT-dagen
- APT räknas som `An` (arbetstid, ej direktvård) — påverkar inte bemanning på brukarvård
- Chefen lägger in APT-datum i systemet → visas automatiskt för hela gruppen

**Kvar att förstå:**
- Utbildningar och kurser — hur hanteras de i schemat?

---

## 🎯 KATEGORI 9: Visionen

### F6.6: Mobilanvändning — stor möjlighet
**Status:** ✅ Bekräftat av Jimmy

**Medvinds mobilapp idag:** Dåligt UI, knappt fungerar. Personalen kan se lönespecifikation — mer eller mindre allt.

**Möjlighet:** Om vi bygger en mobilanpassad vy som faktiskt fungerar är det en omedelbar konkurrensfördel. Personalen kollar redan schema i mobilen — de vill bara ha ett system som faktiskt fungerar.

**Vad personalen vill kunna göra i mobilen:**
- Se sitt schema
- Lägga önskemål
- Rapportera sjukdom
- Få notis om schema ändras

**Tekniskt:** Next.js med responsive design + PWA (Progressive Web App) = fungerar som app utan App Store.

---

### F9.1: Vad accepterar chefen som "klart"?
**Status:** ✅ Delvis besvarad

**Svar från Jimmy:** Ett schema räknas som godkänt när **samordnare och chef har godkänt att bemanningen täcker behovet**.

Det betyder:
- Samordnaren bedömer att vardagens praktiska bemanning fungerar
- Chefen godkänner schemat formellt
- Behovet är inte statiskt; det varierar mellan grupper, pass och dagar
- Systemet behöver därför visa om varje grupp är fulltalig mot sitt aktuella behov, inte bara om antal timmar och lagregler stämmer

**Definition för systemet:**
Ett schemaförslag är redo för godkännande först när:
1. Hårda lag- och avtalsregler är uppfyllda
2. Gruppens bemanningsbehov är uppfyllt per relevant tidsintervall
3. Kritiska lokala regler är uppfyllda, t.ex. 06:45-person
4. Kända belastningsdagar är täckta, t.ex. extra duschar eller omläggningar
5. Eventuella underskott är synliga och aktivt accepterade av samordnare/chef

---

### F9.2: Förslag + godkännande eller helautomatiskt?
**Status:** ❓ Ej besvarad

**Svar:** _(fyll i här)_

---

## 💡 EXTRA - Framtidsidéer (ej i MVP)

Saker som diskuterats men inte är med i grundbygget:

- **Mönsterbaserad schemaläggning:** Varje anställd har ett "livsmönster" (dag-jobbare, kväll-jobbare, ojämna veckor etc) som systemet respekterar.
- **Ett personligt önskemål:** Varje anställd får ETT skyddat önskemål om livssituation (t.ex. "aldrig kvällar på måndagar").
- **Bytesmarknad mellan kollegor:** Notisbaserat byte-system där personal kan be om att bli av med pass och systemet matchar med någon som kan ta det utan regelbrott.
- **Skaraborgs-utvidgning:** Om Töreboda-versionen funkar, paketera om för Mariestad, Gullspång, Karlsborg etc.

Dessa diskuteras i `docs/decisions/framtidsidéer.md`.
