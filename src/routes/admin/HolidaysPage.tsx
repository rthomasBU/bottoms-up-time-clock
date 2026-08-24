import { useState, type FormEvent } from 'react';
import { useHolidays } from '../../hooks/useHolidays';
import { formatDate } from '../../lib/time';

export function HolidaysPage() {
  const { holidays, loading, error, create, remove } = useHolidays();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!name.trim() || !date) {
      setFormError('Enter a name and date.');
      return;
    }
    setSaving(true);
    const { error } = await create(name.trim(), date);
    setSaving(false);
    if (error) setFormError(error);
    else {
      setName('');
      setDate('');
    }
  }

  return (
    <div>
      <h1>
        Company <span>Holidays</span>
      </h1>
      <p className="sub">Shown on everyone's home-page calendar.</p>

      <form className="entry-form" onSubmit={(e) => void handleSubmit(e)} style={{ maxWidth: 320 }}>
        <label htmlFor="holiday-name">Name</label>
        <input
          id="holiday-name"
          type="text"
          placeholder="e.g. Thanksgiving"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label htmlFor="holiday-date">Date</label>
        <input id="holiday-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        {formError && <p className="form-error">{formError}</p>}

        <div className="form-actions">
          <button type="submit" className="btn-build" disabled={saving}>
            {saving ? 'Adding...' : 'Add Holiday'}
          </button>
        </div>
      </form>

      {error && <p className="form-error">{error}</p>}
      {loading && <p>Loading...</p>}
      {!loading && holidays.length === 0 && <p>No holidays added yet.</p>}

      {holidays.length > 0 && (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((h) => (
                <tr key={h.id} className="row">
                  <td>{formatDate(h.holiday_date)}</td>
                  <td>{h.name}</td>
                  <td>
                    <button type="button" className="btn-clear" onClick={() => void remove(h.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
