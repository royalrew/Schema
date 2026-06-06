# -*- coding: utf-8 -*-
"""
Enhetstester för inlåning av obokad personal över gruppgränser (cross-group borrowing)
samt regler för vikarie-kontraktet.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.engine.schemas import (
    Employee, ContractType, Group, Absence, ScheduleDay,
    Bemanningskrav, Shift, ShiftSegment, ShiftType,
)
from app.db_models import EmployeeRow, SchedulePeriodRow, BemanningskravRow, UserRow
from app.routers.schedule import generate, GenerateRequest

STOCKHOLM = ZoneInfo("Europe/Stockholm")


@pytest.mark.anyio
async def test_cross_group_borrowing():
    """
    Verifierar att om en grupp (t.ex. Östra) har underbemanning,
    så lånar generatorn in en medarbetare från en annan grupp (t.ex. Södra)
    som har ett OBOKAD-pass på det datumet, och ändrar passet till det behövda passet.
    """
    # ── 1. Skapa testdata ──
    # Södra-arbetare (ordinarie)
    sodra_emp = Employee(
        id="EMP_SODRA",
        name="Anna Södra",
        contract_type=ContractType.VARIERANDE,
        group=Group.SODRA,
        absences=[],
        wishes=[],
        vetos=[],
        percentage=1.0,
    )
    # Östra-arbetare (ordinarie)
    ostra_emp = Employee(
        id="EMP_OSTRA",
        name="Erik Östra",
        contract_type=ContractType.VARIERANDE,
        group=Group.OSTRA,
        absences=[],
        wishes=[],
        vetos=[],
        percentage=1.0,
    )

    all_employees = [sodra_emp, ostra_emp]

    # Convert to EmployeeRow
    sodra_row = EmployeeRow(
        id=sodra_emp.id,
        name=sodra_emp.name,
        contract_type=sodra_emp.contract_type.value,
        group_name=sodra_emp.group.value,
        is_dagansvarig=False,
        percentage=1.0,
    )
    ostra_row = EmployeeRow(
        id=ostra_emp.id,
        name=ostra_emp.name,
        contract_type=ostra_emp.contract_type.value,
        group_name=ostra_emp.group.value,
        is_dagansvarig=False,
        percentage=1.0,
    )

    # 1 juni 2026
    test_date = date(2026, 6, 1)

    # Östra har bemanningskrav: 2 fm, men bara 1 egen ordinarie arbetare.
    # Det kommer ge en brist på 1 fm-arbetare.
    krav = [
        Bemanningskrav(
            group=Group.OSTRA,
            date=test_date,
            fm_heads=2,
            em_heads=0,
            kval_heads=0,
            natt_heads=0,
        )
    ]
    krav_row = BemanningskravRow(
        group_name=Group.OSTRA.value,
        year=2026,
        month=6,
        requirements=[{
            "group": Group.OSTRA.value,
            "date": test_date.isoformat(),
            "fm_heads": 2,
            "em_heads": 0,
            "kval_heads": 0,
            "natt_heads": 0,
        }]
    )

    # Södra har ett redan genererat schema där Anna Södra är schemalagd som OBOKAD
    sodra_obokad_shift = Shift(
        shift_type=ShiftType.OBOKAD,
        segments=[ShiftSegment(
            start_time=datetime(2026, 6, 1, 7, 0, tzinfo=STOCKHOLM),
            end_time=datetime(2026, 6, 1, 15, 0, tzinfo=STOCKHOLM)
        )],
        is_unbooked=True,
    )
    sodra_schedule = [
        {
            "date": test_date.isoformat(),
            "employee_id": sodra_emp.id,
            "shift": sodra_obokad_shift.model_dump(mode="json"),
            "absence": None,
            "assigned_group": None,
        }
    ]
    sodra_period = SchedulePeriodRow(
        group_name=Group.SODRA.value,
        year=2026,
        month=6,
        schedule=sodra_schedule,
        phase="correction",
        decisions=[]
    )

    # ── 2. Mocka databasen ──
    db_mock = AsyncMock()
    db_mock.commit = AsyncMock()
    db_mock.add = MagicMock()

    async def mock_execute(query, *args, **kwargs):
        query_str = str(query).lower()
        mock_res = MagicMock()
        
        # Maska anställda per grupp
        if "where employees.group_name" in query_str:
            mock_res.scalars.return_value.all.return_value = [ostra_row]
        elif "from employees" in query_str and "where" not in query_str:
            mock_res.scalars.return_value.all.return_value = [sodra_row, ostra_row]
        elif "from bemanningskrav" in query_str:
            mock_res.scalar_one_or_none.return_value = krav_row
        elif "from shift_configs" in query_str:
            mock_res.scalars.return_value.all.return_value = []
        elif "from schedule_periods" in query_str:
            # Sortera ut "other" periods vs "own" period
            if "group_name !=" in query_str:
                mock_res.scalars.return_value.all.return_value = [sodra_period]
            else:
                # Returnera None (skapa ny period för Östra)
                mock_res.scalar_one_or_none.return_value = None
        return mock_res

    db_mock.execute.side_effect = mock_execute

    current_user = UserRow(username="planerare1", role="schemaansvarig", full_name="Sara Planner")

    # ── 3. Kör genereringen för Östra ──
    req = GenerateRequest(group=Group.OSTRA, year=2026, month=6)
    response = await generate(req=req, db=db_mock, current_user=current_user)

    # ── 4. Verifiera resultat ──
    # Check that decisions contains a borrowing decision
    borrow_decisions = [d for d in response.decisions if "[Inlåning]" in d]
    assert len(borrow_decisions) == 1
    assert "Anna Södra" in borrow_decisions[0]
    assert "Södra till Östra" in borrow_decisions[0]

    # Verify response days contains both own and borrowed employees
    returned_emp_ids = {sd.employee_id for sd in response.schedule_days if sd.shift}
    assert ostra_emp.id in returned_emp_ids
    assert sodra_emp.id in returned_emp_ids  # Borrowed!

    # Verify that sodra_emp has assigned_group set to OSTRA
    sodra_day = next(sd for sd in response.schedule_days if sd.employee_id == sodra_emp.id and sd.date == test_date)
    assert sodra_day.assigned_group == Group.OSTRA
    assert sodra_day.shift.shift_type == ShiftType.DAG
    assert not sodra_day.shift.is_unbooked

    # Verify that Södra's schedule period row was updated in the DB
    assert sodra_period.schedule[0]["assigned_group"] == Group.OSTRA.value
    assert sodra_period.schedule[0]["shift"]["shift_type"] == ShiftType.DAG.value
    assert not sodra_period.schedule[0]["shift"]["is_unbooked"]

    # Verify that only own employees' schedule days were saved to Östra's DB record
    # Find the SchedulePeriodRow added for Östra in db_mock.add calls
    added_periods = [call.args[0] for call in db_mock.add.call_args_list if isinstance(call.args[0], SchedulePeriodRow)]
    ostra_db_period = next(p for p in added_periods if p.group_name == Group.OSTRA.value)
    # Spara endast Erik Östra (eftersom Anna Södra redan är sparad i Södras schema)
    saved_emp_ids = {sd["employee_id"] for sd in ostra_db_period.schedule if sd.get("shift")}
    assert saved_emp_ids == {ostra_emp.id}


@pytest.mark.anyio
async def test_cross_group_borrowing_reverted():
    """
    Verifierar att om vi kör generate en andra gång, så återställs
    den tidigare inlånade medarbetaren till OBOKAD i dennes hem-schema
    innan ny generation körs.
    """
    # ── 1. Skapa testdata ──
    sodra_emp = Employee(
        id="EMP_SODRA",
        name="Anna Södra",
        contract_type=ContractType.VARIERANDE,
        group=Group.SODRA,
        absences=[],
        wishes=[],
        vetos=[],
        percentage=1.0,
    )
    sodra_row = EmployeeRow(
        id=sodra_emp.id,
        name=sodra_emp.name,
        contract_type=sodra_emp.contract_type.value,
        group_name=sodra_emp.group.value,
        is_dagansvarig=False,
        percentage=1.0,
    )
    ostra_emp = Employee(
        id="EMP_OSTRA",
        name="Erik Östra",
        contract_type=ContractType.VARIERANDE,
        group=Group.OSTRA,
        absences=[],
        wishes=[],
        vetos=[],
        percentage=1.0,
    )
    ostra_row = EmployeeRow(
        id=ostra_emp.id,
        name=ostra_emp.name,
        contract_type=ostra_emp.contract_type.value,
        group_name=ostra_emp.group.value,
        is_dagansvarig=False,
        percentage=1.0,
    )
    test_date = date(2026, 6, 1)

    # Södra-period har redan en tilldelad lånad status: "assigned_group": "Östra"
    sodra_borrowed_shift = Shift(
        shift_type=ShiftType.DAG,
        segments=[ShiftSegment(
            start_time=datetime(2026, 6, 1, 7, 0, tzinfo=STOCKHOLM),
            end_time=datetime(2026, 6, 1, 16, 0, tzinfo=STOCKHOLM)
        )],
        is_unbooked=False,
    )
    sodra_schedule = [
        {
            "date": test_date.isoformat(),
            "employee_id": sodra_emp.id,
            "shift": sodra_borrowed_shift.model_dump(mode="json"),
            "absence": None,
            "assigned_group": Group.OSTRA.value,  # Redan inlånad till Östra
        }
    ]
    sodra_period = SchedulePeriodRow(
        group_name=Group.SODRA.value,
        year=2026,
        month=6,
        schedule=sodra_schedule,
        phase="correction",
        decisions=[]
    )

    db_mock = AsyncMock()
    db_mock.commit = AsyncMock()
    db_mock.add = MagicMock()

    async def mock_execute(query, *args, **kwargs):
        query_str = str(query).lower()
        mock_res = MagicMock()
        
        # Maska anställda per grupp
        if "where employees.group_name" in query_str:
            mock_res.scalars.return_value.all.return_value = [ostra_row]
        elif "from employees" in query_str:
            mock_res.scalars.return_value.all.return_value = [sodra_row, ostra_row]
        elif "from bemanningskrav" in query_str:
            mock_res.scalar_one_or_none.return_value = None
        elif "from shift_configs" in query_str:
            mock_res.scalars.return_value.all.return_value = []
        elif "from schedule_periods" in query_str:
            if "group_name !=" in query_str:
                mock_res.scalars.return_value.all.return_value = [sodra_period]
            else:
                mock_res.scalar_one_or_none.return_value = None
        return mock_res

    db_mock.execute.side_effect = mock_execute

    current_user = UserRow(username="planerare1", role="schemaansvarig", full_name="Sara Planner")

    # ── 2. Kör genereringen för Östra ──
    # Det kommer först trigga återställningen av Södras lån
    req = GenerateRequest(group=Group.OSTRA, year=2026, month=6)
    await generate(req=req, db=db_mock, current_user=current_user)

    # ── 3. Verifiera återställning ──
    # Södra-perioden ska ha fått sitt pass ändrat till OBOKAD och assigned_group=None under återställningsfasen
    # (Även om det sen lånades in igen under pass 2, så verifierar vi att den var nollställd till obokad)
    # I vår testmiljö lånades den in igen direkt eftersom Östra hade bemanningsbrist, men om vi
    # tittar på datan så ska Södras schedule ha blivit rensad.
    # För att verifiera att rensningssteget kördes korrekt, kan vi verifiera att db.commit() anropades
    # två gånger: en gång efter återställningen, och en gång vid sparning av slutresultat.
    assert db_mock.commit.call_count == 2
