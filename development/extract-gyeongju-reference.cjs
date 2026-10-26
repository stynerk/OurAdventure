const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
function extract(name) {
  const match = source.match(new RegExp('var ' + name + '=(\\[[\\s\\S]*?\\n\\]);'));
  if (!match) throw Error('Reference array not found: ' + name);
  return JSON.parse(match[1]);
}
const quests = extract('quests');
const schedules = extract('schedule');
const reference = {
  kind: 'historical_course_reference', historical_plan_only: true,
  destination: '대한민국 경주', days: 3,
  provenance: { source: 'index.html', itinerarySource: 'GYEONGJU_ITINERARY.md', extractedAt: '2026-10-26', originalTravelDates: ['2026-10-09','2026-10-10','2026-10-11'] },
  notIncluded: ['userPhotos', 'userWrittenMemories', 'completionState', 'confirmedReservations', 'currentOperatingConditions'],
  places: quests.map(q => ({
    legacyPlaceId: q.id, day: q.day, order: q.order, name: q.place,
    icon: q.icon, stampName: q.stamp, contentTitle: q.title,
    photoIdea: q.shot, observationReference: q.look,
    usage: 'Historical content reference; not a verified visit or new MVP requirement.'
  })),
  plannedSchedule: schedules,
  newTripInitialState: { records: [], completions: [] }
};
if (quests.length !== 9 || new Set(quests.map(q=>q.id)).size !== 9) throw Error('Expected nine unique source places');
fs.mkdirSync(path.join(__dirname, 'reference'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'reference/gyeongju-course.json'), JSON.stringify(reference, null, 2) + '\n');
console.log('Exported nine source places as historical planning reference. No browser records accessed.');
