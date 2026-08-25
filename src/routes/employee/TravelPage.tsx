import { TravelDayLogger } from '../../components/TravelDayLogger';

export function TravelPage() {
  return (
    <div>
      <h1>
        Travel <span>(Per Diem)</span>
      </h1>
      <p className="sub">Log the days you traveled for work so payroll can add per diem pay for them.</p>
      <TravelDayLogger />
    </div>
  );
}
