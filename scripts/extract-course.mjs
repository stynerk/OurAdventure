// Root app stays byte-for-byte unchanged. Snapshot its existing content for Phase 1.
import {readFileSync, writeFileSync} from 'node:fs';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const match = html.match(/var quests=(\[[\s\S]*?\n\]);/);
if (!match) throw new Error('Quest JSON boundary changed; review extraction.');
const quests = JSON.parse(match[1]);
const course = {id:'gyeongju-v1', version:1, title:'경주 역사 탐험',
  questIds:quests.map(q=>q.id), requiredQuestIds:quests.filter(q=>!q.optional).map(q=>q.id), quests};
const json = JSON.stringify(course, null, 2) + '\n';
writeFileSync(new URL('../next/course.json', import.meta.url), json);
writeFileSync(new URL('../functions/course.json', import.meta.url), json);
