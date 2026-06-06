import asyncio
import json
import os
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.db_models import SchedulePeriodRow, EmployeeRow

async def main():
    async with AsyncSessionLocal() as db:
        # Hitta den senaste schemalagda perioden
        stmt = select(SchedulePeriodRow).order_by(SchedulePeriodRow.id.desc()).limit(1)
        result = await db.execute(stmt)
        period = result.scalar_one_or_none()
        
        if not period:
            print("Ingen schemaperiod hittades i databasen.")
            return
            
        lines = []
        lines.append(f"# Schema Debug-rapport: {period.group_name}")
        lines.append(f"- **Månad:** {period.year}-{str(period.month).zfill(2)}")
        lines.append(f"- **Fas:** {period.phase}")
        lines.append(f"- **Antal skift:** {len(period.schedule)}")
        
        # Ladda decisions
        decisions_list = []
        if period.decisions:
            if isinstance(period.decisions, str):
                try:
                    decisions_list = json.loads(period.decisions)
                except Exception:
                    decisions_list = [period.decisions]
            elif isinstance(period.decisions, list):
                decisions_list = period.decisions
                
        lines.append("\n## Systemets Beslutslogg (Generatorns val)")
        if decisions_list:
            for idx, d in enumerate(decisions_list, 1):
                try:
                    if isinstance(d, str):
                        clean_d = d.encode('utf-8').decode('unicode-escape')
                    else:
                        clean_d = str(d)
                except Exception:
                    clean_d = str(d)
                lines.append(f"{idx}. {clean_d}")
        else:
            lines.append("*Inga loggar registrerade för denna period.*")
            
        # Hämta de anställda i gruppen för att visa timsaldo
        emp_stmt = select(EmployeeRow).where(EmployeeRow.group_name == period.group_name)
        emp_result = await db.execute(emp_stmt)
        employees = emp_result.scalars().all()
        
        lines.append("\n## Timsaldo-sammanställning")
        lines.append("| Medarbetare | Kontraktstyp | Schemalagda timmar |")
        lines.append("| :--- | :--- | :--- |")
        
        from datetime import datetime
        for emp in employees:
            actual_h = 0.0
            for day in period.schedule:
                if day.get("employee_id") == emp.id and day.get("shift") and not day["shift"].get("is_unbooked"):
                    shift = day["shift"]
                    for seg in shift.get("segments", []):
                        try:
                            s_t = datetime.fromisoformat(seg["start_time"])
                            e_t = datetime.fromisoformat(seg["end_time"])
                            actual_h += (e_t - s_t).total_seconds() / 3600
                        except Exception:
                            pass
            lines.append(f"| {emp.name} | {emp.contract_type} | {round(actual_h, 1)} h |")
            
        report_content = "\n".join(lines)
        
        # Spara till fil
        report_path = os.path.join(os.path.dirname(__file__), "latest_report.md")
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(report_content)
        print(f"Rapport genererad och sparad till: {report_path}")

if __name__ == "__main__":
    asyncio.run(main())
