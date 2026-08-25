import { useState, type FormEvent } from 'react';
import { useHolidays } from '../../hooks/useHolidays';
import { formatDate } from '../../lib/time';
import { getFederalHolidays } from '../../lib/federalHolidays';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR + 1];

export function HolidaysPage() {
  const { holidays, loading, error, create, update, remove, bulkCreate } = useHolidays();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [federalYear, setFederalYear] = useState(CURRENT_YEAR);
  const [addingFederal, setAddingFederal] = useState(false);
  const [federalMessage, setFederalMessage] = useState<string | null>(null);

  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleRemove(id: string) {
    setRemovingId(id);
    setRemoveError(null);
    const { error } = await remove(id);
    if (error) setRemoveError(error);
    setRemovingId(null);
  }

  function startEdit(id: string, currentName: string, currentDate: string) {
    setEditingId(id);
    setName(currentName);
    setDate(currentDate);
    setFormError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setName('');
    setDate('');
    setFormError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!name.trim() || !date) {
      setFormError('Enter a name and date.');
      return;
    }
    setSaving(true);
    const { error } = editingId ? await update(editingId, name.trim(), date) : await create(name.trim(), date);
    setSaving(false);
    if (error) setFormError(error);
    else {
      setEditingId(null);
      setName('');
      setDate('');
    }
  }

  async function handleAddFederalHolidays() {
    setAddingFederal(true);
    setFederalMessage(null);
    const rows = getFederalHolidays(federalYear);
    const { added, error } = await bulkCreate(rows);
    setAddingFederal(false);
    if (error) setFederalMessage(error);
    else {
      const skipped = rows.length - added;
      setFederalMessage(
        added === 0
          ? `All ${rows.length} federal holidays for ${federalYear} were already on the list.`
          : `Added ${added} federal holiday${added === 1 ? '' : 's'} for ${federalYear}${skipped > 0 ? ` (${skipped} already on the list, skipped)` : ''}.`,
      );
    }
  }

  return (
    <div>
      <h1>
        Company <span>Holidays</span>
      </h1>
      <p className="sub">Shown on everyone's calendar.</p>

      <div className="card" style={{ maxWidth: 420 }}>
        <div className="label">Add Federal Holidays</div>
        <p className="form-hint">
          Adds the standard 11 U.S. federal holidays for the selected year (dates computed, not the government's
          weekend-observed shift). Skips any date already on the list below.
        </p>
        <div className="form-actions">
          <select value={federalYear} onChange={(e) => setFederalYear(Number(e.target.value))}>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void handleAddFederalHolidays()} disabled={addingFederal}>
            {addingFederal ? 'Adding...' : 'Add Federal Holidays'}
          </button>
        </div>
        {federalMessage && <p className="form-hint">{federalMessage}</p>}
      </div>

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
            {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Holiday'}
          </button>
          {editingId && (
            <button type="button" className="btn-clear" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {error && <p className="form-error">{error}</p>}
      {removeError && <p className="form-error">{removeError}</p>}
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((h) => (
                <tr key={h.id} className="row">
                  <td>{formatDate(h.holiday_date)}</td>
                  <td>{h.name}</td>
                  <td>
                    <button type="button" className="btn-clear" onClick={() => startEdit(h.id, h.name, h.holiday_date)}>
                      Edit
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-clear"
                      disabled={removingId === h.id}
                      onClick={() => void handleRemove(h.id)}
                    >
                      {removingId === h.id ? 'Removing...' : 'Remove'}
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
