# Frågor till AI-schemasäljaren
> Använd dessa för att avslöja om systemet faktiskt löser Törebodas problem
> eller om det är ett generellt ChatGPT-skal med ny logotyp.

---

## 🔴 KATEGORI 1: Avslöjar om det är AI/LLM eller deterministisk logik

**1. "Om jag matar in exakt samma personaldata och kör systemet igen imorgon — får jag exakt samma schema?"**
> Ett LLM-baserat system varierar. Ett deterministiskt system ger alltid samma svar.
> Säljarens svar avslöjar direkt vilken typ av system det är.

**2. "Kan ni visa mig exakt VARFÖR en specifik person fick ett specifikt pass — vilken regel styrde det beslutet?"**
> LLM kan säga "AI:n bedömde att..." men kan inte visa regelkedjan.
> Om de inte kan peka på en specifik regel i ett regelbibliotek — det är inte deterministiskt.

**3. "Kan ni garantera — inte 'sträva efter', utan garantera — att schemat aldrig bryter mot AML:s krav på 11 timmars dygnsvila?"**
> LLM-system brukar svara med "minimerar regelbrott" eller "strävar efter efterlevnad".
> Rätt svar: "Ja, det är en hård constraint som systemet fysiskt inte kan kringgå."

**4. "Vad händer om era AI-modeller uppdateras eller byts ut — förändras våra scheman?"**
> Om svaret är ja, eller om de tvekar — schemat är icke-deterministiskt och kan inte auditeras.

---

## 🔴 KATEGORI 2: Testar om de förstår hemvård specifikt

**5. "Vi har en regel att exakt EN person per grupp alltid måste börja 06:45 för att ta nattrapporten. Hur konfigurerar ni den regeln, och vem äger den konfigurationen — ni eller vi?"**
> Om de inte förstår nattrapporten eller inte kan visa hur regeln definieras — de har inte byggt för hemvård.

**6. "Vi har 6 grupper med olika storlek — Norra, Östra, Centrum 1, 2, 3 och Moholm. Centrum 3 sitter i annan lokal. Hur hanterar systemet att bemanningsansvarig kommunicerar med Centrum 3 vid akut sjuktäckning?"**
> Generella system tänker inte på fysisk geografi. En bra säljare borde fråga sig vad det innebär — inte bara säga "vi har notisfunktion".

**7. "Vi har en överlappstid 14:00–16:00 där dag- och kvällspersonal är inne samtidigt men dagpersonalen inte är på direktvård — de har kontorstid eller planeringsarbete. Hur förhindrar ert system att denna överlapp räknas som överbemanning i era rapporter?"**
> Om de inte förstår distinktionen Arbete vs Annat arbete — de har inte byggt för hemvård.

**8. "Vi har dagansvariga som aldrig ska schemaläggas på kväll. Vi har planerare som roterar som helgansvariga och som ibland inte vill ha den rollen. Hur hanterar systemet dessa personattribut och preferenser?"**
> Generella system kan inte hantera rollspecifika schemaregler utan manuell konfiguration varje gång.

---

## 🔴 KATEGORI 3: Testar kontinuitet och rättvisa

**9. "Kontinuitet är kärnkvalitet i hemvård — brukarna mår bättre av att känna sin personal. Hur spårar ert system när ordinarie personal ersätts av vikarie, och hur synliggör det detta för chefen?"**
> De flesta system räknar bara antal — inte VEM som är inplanerad. Det är en grundläggande svaghet.

**10. "Hur visar systemet om helgansvarig-rotationen är rättvis över tid? Vi har ett problem med att inte alla vill ha helgansvar."**
> Om de inte har ett rättvise-trackingsystem — de har inte förstått att schemarättvisa är en facklig och social fråga, inte bara logistik.

---

## 🔴 KATEGORI 4: Dolda kostnader och inlåsning

**11. "Vad kostar implementationen? Vad kostar löpande drift per månad? Vad ingår INTE i grundpriset?"**
> Be dem specificera: utbildning, support, anpassningar, integrationer, extra licenser.

**12. "Vi använder Personec för lön. Hur exporterar ert system löneunderlaget? Är det en standardintegration eller kostar det extra?"**
> Personec-integration är ett måste. Om det kostar extra eller tar månader — det är en deal-breaker.

**13. "Om vi om 3 år vill byta system — i vilket format exporterar vi ut all vår data, och vad kostar det?"**
> Svar: "Vi har ett öppet API och standardformat" = bra.
> Svar: "Vi hjälper er med en migrering" = de äger er data.

**14. "Hur lång är implementationstiden innan vi har ett fungerande schema för Töreboda?"**
> Räkna med att de underskattar. Fråga: "Vad är er genomsnittliga implementation för en liknande kommun?"

---

## 🔴 KATEGORI 5: GDPR och säkerhet

**15. "Var lagras personaldata? Är det en svensk server, EU, eller utanför EU?"**
> Hemvård innehåller känslig personaldata. Lagringen måste vara GDPR-kompatibel.

**16. "Vem har access till vår data hos er? Kan er supportpersonal se enskilda anställdas scheman?"**

---

## 💡 SAMMANFATTNING — Röda flaggor att lyssna efter

| De säger... | Det betyder... |
|---|---|
| "AI:n lär sig av ert schema" | Icke-deterministiskt — kan inte garantera regler |
| "Vi strävar efter att följa regler" | Inte garanterat regelföljande |
| "Vi kan anpassa det" | Det är inte byggt för hemvård |
| "Implementationen tar 3–6 månader" | Komplext, dyrt, riskfyllt |
| "Integrationer diskuterar vi separat" | Det kostar extra |
| "Vi hjälper er exportera data vid byte" | De äger er data |
| "Systemet optimerar baserat på mönster" | LLM/ML — kan inte förklara beslut |

## ✅ Bra svar att lyssna efter

| De säger... | Det betyder... |
|---|---|
| "Här är regelbiblioteket — alla regler är definierade som kod" | Deterministiskt ✓ |
| "Samma input ger alltid samma output" | Deterministiskt ✓ |
| "Regelbrott är fysiskt omöjliga — hård constraint" | Pålitligt ✓ |
| "Personec-integration ingår i grundpriset" | Ärligt ✓ |
| "Data exporteras i JSON/CSV, inga kostnader" | Öppet system ✓ |
