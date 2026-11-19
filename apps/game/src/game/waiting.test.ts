import { describe, expect, it } from 'vitest';
import type { Assignment } from '../api';
import { sheetPoint, waitingAt, waitingPoints } from './waiting';

const steps = [{ pointId: 'shed' }, { pointId: 'well' }, { pointId: 'bed' }];

function sheet(over: Partial<Assignment> & { subject?: string }): Assignment {
  const { subject = 'mathematics', ...rest } = over;
  return {
    id: Math.random().toString(36).slice(2),
    status: 'answered_on_paper',
    exercise: { subject, statement: 'Combien de cubes y a-t-il en tout? Écris le nombre.' } as unknown as Assignment['exercise'],
    hintUsed: false,
    missionId: null,
    missionStep: null,
    selectionReason: '',
    createdAt: '2026-11-17T04:25:00.000Z',
    reviews: [],
    outcome: null,
    ...rest,
  } as Assignment;
}

describe('sheets waiting for a parent in the garden', () => {
  it('the stale mission sheet of the family data (step 1, answered on paper) belongs to the remise', () => {
    const stale = sheet({ missionId: 'garden-seeds', missionStep: 0 });
    expect(sheetPoint(stale, steps)).toBe('shed');
    expect(waitingPoints([stale], steps)).toEqual(['shed']);
    expect(waitingAt([stale], steps, 'shed')?.id).toBe(stale.id);
    // the other stations stay free to play
    expect(waitingAt([stale], steps, 'well')).toBeNull();
    expect(waitingAt([stale], steps, 'bed')).toBeNull();
  });

  it('a sheet still on screen (presented) or already closed does not wait for a parent', () => {
    for (const status of ['presented', 'confirmed', 'cancelled'] as const) {
      expect(waitingPoints([sheet({ status, missionId: 'garden-seeds', missionStep: 0 })], steps)).toEqual([]);
    }
    expect(waitingPoints([sheet({ status: 'in_review', subject: 'french' })], steps)).toEqual(['well']);
    expect(waitingPoints([sheet({ status: 'illegible', subject: 'mathematics' })], steps)).toEqual(['shed']);
  });

  it('practice sheets go to the station of their subject; the mission sheet comes first, without repeats', () => {
    const practice = sheet({ subject: 'french' });
    const practice2 = sheet({ subject: 'mathematics' });
    const mission = sheet({ missionId: 'garden-seeds', missionStep: 0 });
    expect(waitingPoints([practice, practice2, mission], steps)).toEqual(['shed', 'well']);
    expect(waitingAt([practice2, mission], steps, 'shed')?.id).toBe(mission.id);
    expect(sheetPoint(sheet({ subject: 'english' }), steps)).toBeNull();
  });
});
