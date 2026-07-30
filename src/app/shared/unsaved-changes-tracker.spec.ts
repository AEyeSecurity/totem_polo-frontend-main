import { UnsavedChangesTracker } from './unsaved-changes-tracker';

describe('UnsavedChangesTracker', () => {
  let tracker: UnsavedChangesTracker;

  beforeEach(() => {
    tracker = new UnsavedChangesTracker();
  });

  it('should report no changes for a form that was never saved', () => {
    expect(tracker.hasChanged('vehiculo', { a: 1 })).toBeFalse();
  });

  it('should report no changes when the current data matches the saved snapshot', () => {
    const form = { nombre: 'ACME', activo: true };
    tracker.save('empresa', form);

    expect(tracker.hasChanged('empresa', { nombre: 'ACME', activo: true })).toBeFalse();
  });

  it('should report changes when the current data differs from the snapshot', () => {
    tracker.save('empresa', { nombre: 'ACME' });

    expect(tracker.hasChanged('empresa', { nombre: 'ACME SA' })).toBeTrue();
  });

  it('should not be affected by later mutations of the original object reference', () => {
    const form = { nombre: 'ACME' };
    tracker.save('empresa', form);
    form.nombre = 'Mutated';

    expect(tracker.hasChanged('empresa', { nombre: 'ACME' })).toBeFalse();
  });

  it('getInitial should return a deep clone independent from the stored snapshot', () => {
    tracker.save('empresa', { datos: { a: 1 } });

    const initial = tracker.getInitial<{ datos: { a: number } }>('empresa');
    initial!.datos.a = 999;

    expect(tracker.getInitial<{ datos: { a: number } }>('empresa')!.datos.a).toBe(1);
  });

  it('getInitial should return undefined when nothing was saved for that form', () => {
    expect(tracker.getInitial('nope')).toBeUndefined();
  });

  it('clear should remove the tracked snapshot for a single form', () => {
    tracker.save('empresa', { nombre: 'ACME' });
    tracker.save('usuario', { email: 'a@b.com' });

    tracker.clear('empresa');

    expect(tracker.getInitial('empresa')).toBeUndefined();
    expect(tracker.getInitial('usuario')).toBeDefined();
  });

  it('clearAll should remove every tracked snapshot', () => {
    tracker.save('empresa', { nombre: 'ACME' });
    tracker.save('usuario', { email: 'a@b.com' });

    tracker.clearAll();

    expect(tracker.getInitial('empresa')).toBeUndefined();
    expect(tracker.getInitial('usuario')).toBeUndefined();
  });
});
