import { TechSupportDayLogger } from '../../components/TechSupportDayLogger';

export function TechSupportPage() {
  return (
    <div>
      <h1>
        Tech <span>Support</span>
      </h1>
      <p className="sub">Log the days you spent on tech support so payroll can add pay for them.</p>
      <TechSupportDayLogger />
    </div>
  );
}
