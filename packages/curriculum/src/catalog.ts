import type { MissionDefinition, SkillDefinition, Subject } from '@melina/shared';
import mathSkills from '../../../content/mathematics/skills.json';
import frenchSkills from '../../../content/french/skills.json';
import englishSkills from '../../../content/english/skills.json';
import gardenMission from '../../../content/missions/garden.json';

export const skills: SkillDefinition[] = [
  ...(mathSkills.skills as SkillDefinition[]),
  ...(frenchSkills.skills as SkillDefinition[]),
  ...(englishSkills.skills as SkillDefinition[]),
];

export const missions: MissionDefinition[] = [gardenMission as MissionDefinition];

export function getSkill(id: string): SkillDefinition {
  const s = skills.find((k) => k.id === id);
  if (!s) throw new Error(`Unknown skill: ${id}`);
  return s;
}

export function skillsBySubject(subject: Subject | 'any'): SkillDefinition[] {
  return subject === 'any' ? skills : skills.filter((s) => s.subject === subject);
}

export function getMission(id: string): MissionDefinition {
  const m = missions.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown mission: ${id}`);
  return m;
}
