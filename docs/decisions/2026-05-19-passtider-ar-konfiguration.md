# Beslut: Passtider är konfiguration, inte hårdkodade regler

**Datum:** 2026-05-19  
**Status:** Beslutat

## Kontext

De passtider som dokumenterats, t.ex. 06:45, 07:00, 13:45, 20:00 och 21:30, beskriver hur verksamheten ofta fungerar idag. De är inte permanenta sanningar.

Hemvårdens behov kan ändras snabbt. Exempel: en brukare blir palliativ och behöver sena kvällsbesök, vilket kan göra att framtida turer som tidigare slutade 20:00 behöver sluta 21:30.

## Beslut

Passtyper, starttider och sluttider ska vara **konfigurerbara per grupp och giltighetsperiod**.

De får inte hårdkodas i regelmotorn.

## Konsekvenser

- Regelmotorn ska alltid räkna på faktiska passintervall.
- En grupp ska kunna ändra sina standardpass utan kodändring.
- Nya passtider ska kunna gälla från ett visst datum.
- Historiska scheman ska behålla de tider som gällde när schemat skapades.
- Ändring från t.ex. 20:00 till 21:30 ska automatiskt trigga ny kontroll av dygnsvila och bemanning framåt.

## Designprincip

Verksamhetens behov styr tiderna. Systemet ska hänga med.
