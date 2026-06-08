"use client";
import { useState, useEffect } from "react";
import { Building2, Save, Check, HelpCircle, Loader2 } from "lucide-react";
import { fetchOrganizationSettings, saveOrganizationSettings, type OrganizationSettings } from "@/lib/api";

const MUNICIPALITIES = [
  { name: "Töreboda Kommun", orgNumber: "212000-1678" },
  { name: "Mariestad Kommun", orgNumber: "212000-1686" },
  { name: "Skövde Kommun", orgNumber: "212000-1660" },
  { name: "Gullspångs Kommun", orgNumber: "212000-1694" },
  { name: "Karlsborgs Kommun", orgNumber: "212000-1637" },
  { name: "Lidköpings Kommun", orgNumber: "212000-1652" },
  { name: "Skara Kommun", orgNumber: "212000-1645" },
  { name: "Falköpings Kommun", orgNumber: "212000-1595" },
  { name: "Hjo Kommun", orgNumber: "212000-1587" },
  { name: "Tibro Kommun", orgNumber: "212000-1629" },
  { name: "Tidaholms Kommun", orgNumber: "212000-1611" },
  { name: "Vara Kommun", orgNumber: "212000-1561" },
  { name: "Götene Kommun", orgNumber: "212000-1603" },
  { name: "Grästorps Kommun", orgNumber: "212000-1553" },
  { name: "Essunga Kommun", orgNumber: "212000-1546" },
];

export function BillingConfigEditor() {
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Valideringsfel för enskilda fält
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchOrganizationSettings()
      .then((data) => {
        setSettings(data);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Det gick inte att hämta organisationens uppgifter.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  function validate(): boolean {
    if (!settings) return false;
    const errors: Record<string, string> = {};

    if (!settings.org_name.trim()) {
      errors.org_name = "Organisationsnamn är obligatoriskt.";
    }

    // Validera svenskt organisationsnummer (10 siffror, eventuellt med bindestreck)
    if (settings.org_number) {
      const cleanNum = settings.org_number.replace(/\D/g, "");
      if (cleanNum.length !== 10) {
        errors.org_number = "Organisationsnummer måste bestå av 10 siffror (t.ex. 212000-1234).";
      }
    }

    // PEPPOL-ID validering (ofta 0007:organisationsnummer i Sverige)
    if (settings.peppol_id && !/^\d{4}:.+$/.test(settings.peppol_id)) {
      errors.peppol_id = "PEPPOL-ID ska vara i formatet ISOkod:nummer, till exempel 0007:2120001234.";
    }

    // E-post validering om angett
    if (settings.invoice_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(settings.invoice_email)) {
        errors.invoice_email = "Ange en giltig e-postadress.";
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings || !validate()) return;

    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const updated = await saveOrganizationSettings(settings);
      setSettings(updated);
      setSaved(true);
      // Dölj framgångsindikatorn efter 3 sekunder
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ett fel uppstod när inställningarna sparades.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-6 animate-pulse">
        <div className="h-6 w-48 bg-gray-200 rounded" />
        <div className="h-4 w-72 bg-gray-200 rounded" />
        <div className="space-y-4 pt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 bg-gray-200 rounded" />
              <div className="h-10 w-full bg-gray-100 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3">
        <p className="text-sm font-semibold text-red-800">Kunde inte ladda faktureringsinställningar</p>
        <p className="text-xs text-red-600">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition"
        >
          Försök igen
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-ink/8 p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-ink flex items-center gap-2">
          <Building2 className="w-5 h-5 text-terracotta" />
          Fakturerings- & Organisationsuppgifter (B2G)
        </h2>
        <p className="text-xs text-ink-soft mt-1">
          Sintari stöder PEPPOL e-fakturering för kommuner och regioner. Fyll i era uppgifter nedan för automatisk hantering.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Snabbval Kommun */}
          <div className="md:col-span-2 bg-paper/60 border border-ink/8 rounded-xl p-4 space-y-2">
            <label className="text-xs font-bold text-ink-soft flex items-center gap-1.5" htmlFor="municipality_select">
              <span>Hämta uppgifter från kommun (Snabbval)</span>
              <span className="text-[9px] bg-terracotta/10 text-terracotta px-2 py-0.5 rounded font-bold uppercase tracking-wider">Autofyll</span>
            </label>
            <select
              id="municipality_select"
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                const selected = MUNICIPALITIES.find(m => m.orgNumber === val);
                if (selected) {
                  const cleanOrg = selected.orgNumber.replace(/\D/g, "");
                  setSettings({
                    ...settings,
                    org_name: selected.name,
                    org_number: selected.orgNumber,
                    peppol_id: `0007:${cleanOrg}`
                  });
                  setValidationErrors(prev => ({ ...prev, org_name: "", org_number: "", peppol_id: "" }));
                }
                e.target.value = "";
              }}
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 transition-shadow text-ink cursor-pointer"
            >
              <option value="">-- Välj din kommun för att fylla i organisationsuppgifter --</option>
              {MUNICIPALITIES.map(m => (
                <option key={m.orgNumber} value={m.orgNumber}>
                  {m.name} ({m.orgNumber})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-ink-soft/60 font-sans leading-relaxed">
              Genom att välja din kommun i listan fylls organisationsnamn, organisationsnummer och PEPPOL-ID i automatiskt. Du behöver sedan bara ange din enhets lokala referenskod (ZZ-kod).
            </p>
          </div>

          {/* Organisationsnamn */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink-soft" htmlFor="org_name">
              Organisationsnamn <span className="text-red-500">*</span>
            </label>
            <input
              id="org_name"
              type="text"
              value={settings.org_name}
              onChange={(e) => {
                setSettings({ ...settings, org_name: e.target.value });
                if (validationErrors.org_name) {
                  setValidationErrors({ ...validationErrors, org_name: "" });
                }
              }}
              className={`w-full bg-white border rounded-xl px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 transition-shadow ${
                validationErrors.org_name ? "border-red-300" : "border-gray-200"
              }`}
              placeholder="Töreboda Kommun"
            />
            {validationErrors.org_name && (
              <p className="text-[10px] text-red-500 font-medium">{validationErrors.org_name}</p>
            )}
          </div>

          {/* Organisationsnummer */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink-soft" htmlFor="org_number">
              Organisationsnummer
            </label>
            <input
              id="org_number"
              type="text"
              value={settings.org_number ?? ""}
              onChange={(e) => {
                setSettings({ ...settings, org_number: e.target.value });
                if (validationErrors.org_number) {
                  setValidationErrors({ ...validationErrors, org_number: "" });
                }
              }}
              className={`w-full bg-white border rounded-xl px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 transition-shadow ${
                validationErrors.org_number ? "border-red-300" : "border-gray-200"
              }`}
              placeholder="212000-1234"
            />
            {validationErrors.org_number && (
              <p className="text-[10px] text-red-500 font-medium">{validationErrors.org_number}</p>
            )}
          </div>

          {/* PEPPOL-ID */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <label className="text-xs font-semibold text-ink-soft" htmlFor="peppol_id">
                PEPPOL-ID
              </label>
              <div className="group relative">
                <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-64 p-2 bg-ink text-white text-[10px] rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-20 shadow-lg leading-relaxed">
                  Formatet för svenska kommuner är vanligtvis <code className="bg-white/10 px-1 rounded">0007:organisationsnummer</code> (utan bindestreck).
                </div>
              </div>
            </div>
            <input
              id="peppol_id"
              type="text"
              value={settings.peppol_id ?? ""}
              onChange={(e) => {
                setSettings({ ...settings, peppol_id: e.target.value });
                if (validationErrors.peppol_id) {
                  setValidationErrors({ ...validationErrors, peppol_id: "" });
                }
              }}
              className={`w-full bg-white border rounded-xl px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 transition-shadow ${
                validationErrors.peppol_id ? "border-red-300" : "border-gray-200"
              }`}
              placeholder="0007:2120001234"
            />
            {validationErrors.peppol_id && (
              <p className="text-[10px] text-red-500 font-medium">{validationErrors.peppol_id}</p>
            )}
          </div>

          {/* Fakturareferens / ZZ-kod */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <label className="text-xs font-semibold text-ink-soft" htmlFor="zz_reference">
                Fakturareferens (ZZ-kod)
              </label>
              <div className="group relative">
                <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-64 p-2 bg-ink text-white text-[10px] rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-20 shadow-lg leading-relaxed">
                  ZZ-koden eller referenskoden används av kommunens ekonomisystem (t.ex. Raindance, Proceedo) för att automatiskt styra fakturan till rätt enhet eller enhetschef.
                </div>
              </div>
            </div>
            <input
              id="zz_reference"
              type="text"
              value={settings.zz_reference ?? ""}
              onChange={(e) => setSettings({ ...settings, zz_reference: e.target.value })}
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 transition-shadow"
              placeholder="ZZ12345"
            />
          </div>

          {/* PDF-Faktura E-post */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink-soft" htmlFor="invoice_email">
              E-post för reservfaktura (PDF)
            </label>
            <input
              id="invoice_email"
              type="email"
              value={settings.invoice_email ?? ""}
              onChange={(e) => {
                setSettings({ ...settings, invoice_email: e.target.value });
                if (validationErrors.invoice_email) {
                  setValidationErrors({ ...validationErrors, invoice_email: "" });
                }
              }}
              className={`w-full bg-white border rounded-xl px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 transition-shadow ${
                validationErrors.invoice_email ? "border-red-300" : "border-gray-200"
              }`}
              placeholder="ekonomi@kommun.se"
            />
            {validationErrors.invoice_email && (
              <p className="text-[10px] text-red-500 font-medium">{validationErrors.invoice_email}</p>
            )}
          </div>

          {/* Abonnemang och Licens (Read-only) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink-soft">
              Abonnemang & Licens
            </label>
            <div className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-ink-soft/80 flex items-center justify-between">
              <span className="font-semibold text-ink">
                {settings.billing_plan === "enterprise" ? "Kommunlicens Enterprise" : settings.billing_plan === "demo" ? "Sandlåda (Demo)" : "Standardlicens"}
              </span>
              <span className="text-[10px] uppercase tracking-wider font-bold bg-terracotta/10 text-terracotta px-2 py-0.5 rounded">
                Aktiv
              </span>
            </div>
          </div>

        </div>

        <div className="pt-4 flex items-center justify-between border-t border-gray-100">
          <p className="text-[10px] text-ink-soft/60">
            Fält markerade med <span className="text-red-500">*</span> är obligatoriska.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-terracotta hover:bg-clay disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Sparar..." : saved ? "Sparat!" : "Spara uppgifter"}
          </button>
        </div>
      </form>
    </div>
  );
}
