# -*- coding: utf-8 -*-
"""
Enhetstester för Sintari RAG-Assistent (chat router).
Verifierar skyddsbarriärer (Guardrails), avsiktsanalys och datumsökning.
"""

from datetime import date
import pytest
from app.routers.chat import _check_blocked_intent, _extract_date_and_name


def test_guardrails_blocked_intent():
    """Verifierar att fackliga, lagstiftande och lönefrågor blockeras."""
    # Fackliga frågor
    assert _check_blocked_intent("Kan facket hjälpa mig med mitt schema?") is not None
    assert _check_blocked_intent("Vad säger kollektivavtalet om övertid?") is not None
    
    # Lagar & ATL
    assert _check_blocked_intent("Bryter detta schema mot arbetstidslagen?") is not None
    assert _check_blocked_intent("Är det lagligt att jobba delad tur?") is not None
    
    # Löner & OB
    assert _check_blocked_intent("Hur mycket får jag i OB-ersättning?") is not None
    assert _check_blocked_intent("Vad är min månadslön?") is not None
    
    # Gröna zonen (ska INTE blockeras)
    assert _check_blocked_intent("Hur lägger jag in ett önskeschema?") is None
    assert _check_blocked_intent("När jobbar Elin nästa fredag?") is None


def test_guardrails_health_privacy():
    """Verifierar att sekretessbelagd hälsoinformation spärras enligt GDPR."""
    assert _check_blocked_intent("Varför är Kalle sjukskriven idag?") is not None
    assert _check_blocked_intent("Vad är orsaken till Kalles sjukdom?") is not None
    
    # Sjuk utan personlig information (ska INTE blockeras)
    assert _check_blocked_intent("Vem kontaktar jag om jag blir sjuk?") is None


def test_date_and_name_extraction():
    """Verifierar att namn och datum kan extraheras deterministiskt ur meddelandet."""
    # Format: 25 maj (standardiseras till år 2026)
    name, extracted_date = _extract_date_and_name("Hur jobbar Elin på fredag den 25e maj?")
    assert name == "Elin"
    assert extracted_date == date(2026, 5, 25)
    
    # Format: YYYY-MM-DD
    name, extracted_date = _extract_date_and_name("Visa schema för Elin den 2026-06-12")
    assert name == "Elin"
    assert extracted_date == date(2026, 6, 12)
    
    # Format: slash 25/5
    name, extracted_date = _extract_date_and_name("Jobbar Sara den 25/5?")
    assert name == "Sara"
    assert extracted_date == date(2026, 5, 25)

    # Personalen frågar om sig själv (namn kan vara stoppord men datum stämmer)
    name, extracted_date = _extract_date_and_name("När jobbar jag den 12 juni?")
    assert extracted_date == date(2026, 6, 12)
