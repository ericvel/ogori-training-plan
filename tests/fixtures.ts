// Invented activity records: no personal Garmin data belongs in test source.
import type { TrainingState } from '../shared/model.ts'
export function fixture(): TrainingState {
  return {
    schemaVersion: 1,
    plan: {
      version: 2,
      raceDate: '2027-03-14',
      timezone: 'Asia/Tokyo',
      goal: 'Under 1:35',
      guidance: [],
      weeks: [
        {
          number: 1,
          start: '2026-10-19',
          recovery: false,
          sessions: [
            { id: 'w1-a', date: '2026-10-23', kind: 'Core', title: 'Easy run' },
            { id: 'w1-b', date: '2026-10-25', kind: 'Core', title: 'Long run' },
          ],
        },
        {
          number: 2,
          start: '2026-10-26',
          recovery: false,
          sessions: [
            { id: 'w2-a', date: '2026-10-27', kind: 'Core', title: 'Easy run' },
            { id: 'w2-b', date: '2026-11-01', kind: 'Core', title: 'Long run' },
          ],
        },
        {
          number: 3,
          start: '2026-11-02',
          recovery: false,
          sessions: [
            { id: 'w3-a', date: '2026-11-03', kind: 'Core', title: 'Tempo' },
            { id: 'w3-optional', date: '2026-11-05', kind: 'Optional', title: 'Easy run' },
            { id: 'w3-b', date: '2026-11-08', kind: 'Race', title: 'Race' },
          ],
        },
      ],
    },
    progress: { 'w3-optional': { status: 'completed', note: 'Legacy note', actualDate: null } },
    activities: [],
  }
}
export const header =
  'Activity Type,Date,Title,Distance,Time,Avg Pace,Avg HR,Max HR,Steps,Min Elevation,Best Lap Time'
export const row =
  'Running,2026-10-20 08:12:34,week1coreA,5.25,00:35:00,6:40,123,145,"5,000",\'-2,00:03:02.5'
export const csv = `${header}\r\n${row}\r\nRunning,2026-10-29 09:45:00,week2optional,6.25,00:42:30,6:48,122,150,"6,500",--,00:03:10.1\r\n`
