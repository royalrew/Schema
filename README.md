# Töreboda Hemvård - Schemamotor

Specialanpassad deterministisk schemaläggning för hemvården i Töreboda kommun.

## Status

🚧 Researchfas - kunskapsinsamling pågår

## Projektets faser

### Fas 1: Research & Verksamhetsförståelse (pågår)
- [x] Skapa frågedokument
- [x] Sammanställa lagstiftning
- [ ] Fylla i svar löpande från arbetsplatsen
- [ ] Ladda upp Personec-observationer
- [ ] Verifiera regler med samordnare/fack

### Fas 2: Designprinciper
- [ ] Spika datamodell
- [ ] Skriva regelmotorns pseudokod
- [ ] Validera mot lagstiftning
- [ ] Designa UI-flöde

### Fas 3: Bygge av MVP
- [ ] Next.js + Postgres-uppsättning
- [ ] Datamodellen implementerad
- [ ] Regelmotorn implementerad
- [ ] Enkel UI för demonstration
- [ ] Testdata med Töreboda-grupperna

### Fas 4: Demo & Utvärdering
- [ ] Demo för chefen efter mötet med leverantören
- [ ] Jämförelse mot leverantörens lösning
- [ ] Beslut om nästa steg

## Mapp-struktur

```
toreboda-schema/
├── CLAUDE.md                          # Instruktioner till Claude Code
├── README.md                          # Detta dokument
├── docs/
│   ├── research/
│   │   └── questions.md               # ⭐ Levande dokument med alla frågor/svar
│   ├── lagstiftning/
│   │   └── regler.md                  # Hårda regler från lag/avtal
│   ├── personec/
│   │   ├── README.md                  # Hur Personec-info ska hanteras
│   │   ├── observations.md            # Strukturella observationer
│   │   └── *.png                      # Maskerade skärmdumpar
│   └── decisions/                     # (kommer skapas) Designbeslut
└── (kod tillkommer senare)
```

## Arbetssätt med Claude Code

1. Jimmy startar Claude Code i projektmappen
2. Claude Code läser `CLAUDE.md` för instruktioner
3. Frågor besvaras genom att uppdatera `docs/research/questions.md`
4. Nya insikter loggas i `docs/decisions/`
5. Kod skrivs FÖRST när tillräcklig research finns
