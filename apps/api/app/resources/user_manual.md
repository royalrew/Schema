# Användarmanual: Töreboda Schema

Denna manual beskriver hur medarbetare och administratörer navigerar och använder Töreboda Schema.

## 1. Önskeschema och Ledighetsönskemål
Som medarbetare kan du lägga in önskemål om specifika arbetspass eller önskemål om att vara helt ledig under en period.
* **Hur du navigerar:** Klicka på din personliga profil/kalendersida (t.ex. genom att klicka på din profilbild eller ditt namn i sidhuvudet).
* **Lägga in önskemål:**
  1. Gå till den månad och dag du vill önska i kalendervyn.
  2. Klicka på dagen. En dialogruta öppnas.
  3. Välj om du vill önska ett specifikt pass (t.ex. *Dagtid*, *Morgonpass 06:45*, *Kvällspass*) eller önska *Ledigt*.
  4. Klicka på **Spara**. Dagen markeras nu i gult som önskemål.
* **OBS:** Önskemål måste läggas in under planeringfasen ("Önskefas"). När schemat går in i granskningsfasen stängs önskefunktionen.

## 2. Timbalans och Medvind-saldo
Systemet håller ordning på dina schemalagda timmar och jämför dem med din kontraktstid.
* **Ingångssaldo:** Vid varje periods början importeras ditt ingående timsaldo från Medvind.
* **Hur du ser dina timsaldon:** 
  * För personal: Öppna din personliga kalender. Längst ner eller i sidopanelen ser du en sammanställning av ditt timsaldo för gällande månad.
  * För administratörer: Klicka på fliken **"Timsaldo"** under schematabellen för att se en fullständig lista över alla medarbetares timsaldon och eventuella underskott eller överskott.

## 3. Schemagenerering och Autoschema (Endast administratörer)
Administratörer kan låta systemets optimeringsmotor generera ett färdigt schemaförslag.
* **Hur du gör:**
  1. Navigera till schemasidan för din grupp (t.ex. *Norra* eller *Södra*).
  2. Klicka på den orangea knappen **"Kör autoschema"**.
  3. Systemet räknar ut det optimala schemat baserat på bemanningskrav, rotationsprinciper för 06:45-passet samt deltidskompensation.
  4. Efter generering visas **"Systemets Beslutslogg"** längst ner på sidan, vilken förklarar exakt varför motorn gjorde varje val.

## 4. Export och Utskrift av Schema
Du kan enkelt skriva ut schemat eller spara det digitalt.
* **Hur du gör:**
  1. Gå till schemasidan.
  2. Klicka på **"Skriv ut"**-knappen i verktygsfältet över tabellen.
  3. En renodlad, utskriftsvänlig version av schemat öppnas. Tryck `Ctrl + P` (eller `Cmd + P`) för att skriva ut till din lokala skrivare eller spara som PDF.
  4. Du kan också klicka på **"Exportera Excel"** för att ladda ner schemat som ett kalkylblad.

## 5. Ändra Lösenord och Profilinställningar
* **Hur du gör:**
  1. Gå till fliken **"Inställningar"** i huvudmenyn.
  2. Under profilinställningar kan du uppdatera ditt lösenord och se dina grundläggande anställningsuppgifter (t.ex. tjänstgöringsgrad och kontraktstyp).
  3. Klicka på **Spara**.

## 6. Hur fungerar Sintaris schemamotor?
Sintari använder en avancerad, deterministisk optimeringsmotor (inte en gissande AI-modell). Den beräknar det optimala schemat baserat på verksamhetens exakta bemanningskrav, gällande lagstiftning, kollektivavtal samt medarbetarnas önskemål och semestrar. Detta garanterar ett juridiskt korrekt och rättvist schema på några minuter utan gissningar eller "svarta lådan"-beslut.

## 7. Stödjer systemet integration med externa personalsystem?
Ja, Sintari har fullt stöd för att integrera med befintliga personal- och planeringssystem (såsom Medvind, Personec m.fl.). Vi kan importera ingående timsaldon vid periodens start och exportera det färdiga, attesterade schemat direkt tillbaka till ert ekonomisystem för lönehantering. Detta eliminerar manuellt dubbelarbete för planerare.

## 8. Hur skyddas personlig data och GDPR?
Säkerhet och personlig integritet är högsta prioritet. Sintari är byggt med fullt GDPR-skydd. All känslig data lagras säkert i krypterade databaser och vi tillämpar strikt rollbaserad behörighetskontroll (RBAC). Dessutom körs en lokal anonymiseringsmotor (PII-tvätt) som maskerar alla medarbetares namn till unika ID-koder innan eventuell extern bearbetning görs, vilket säkerställer att ingen personlig information läcker ut.


