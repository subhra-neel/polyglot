import "server-only";
import scenes from "@/content/kn-scenes.json";
import { getUnit, getUnits, type LessonSummary } from "@/lib/lessons";
import { getProgress, type Progress } from "@/lib/progress";

/**
 * The course as one path: every level's units in order, each with its
 * lessons, its unit check, and any tutor scenes that practise it.
 */

export const LEVELS: Record<number, { title: string; canDo: string }> = {
  1: { title: "Absolute beginner", canDo: "Greet, introduce yourself, ask for things, ask where and how much." },
  2: { title: "Basic communication", canDo: "Describe your day, family and plans; talk about yesterday." },
  3: { title: "Conversational", canDo: "Shop, bargain, order food, explain a problem, see a pharmacist." },
  4: { title: "Intermediate", canDo: "Handle work, phone calls, complaints and a clinic visit; give opinions." },
  5: { title: "Advanced", canDo: "Converse spontaneously, joke, disagree politely, follow films and news." },
};

export type PathScene = { slug: string; title: string };
export type PathUnit = {
  slug: string;
  title: string;
  position: number;
  level: number;
  lessons: LessonSummary[];
  scenes: PathScene[];
};
export type PathLevel = { level: number; title: string; canDo: string; units: PathUnit[] };
export type LearningPath = { levels: PathLevel[]; progress: Progress };

type SceneInfo = { slug: string; title: string; min_level: number; uses_units: string[] };

/**
 * Puts each tutor scene after the last unit it practises (in path order), so
 * a scene comes up once everything it needs has been learned. Scenes whose
 * units are not on the path are left out.
 */
export function placeScenes(unitOrder: string[], list: SceneInfo[]): Map<string, PathScene[]> {
  const at = new Map<string, PathScene[]>();
  for (const scene of list) {
    const positions = scene.uses_units.map((u) => unitOrder.indexOf(u)).filter((i) => i >= 0);
    if (!positions.length) continue;
    const unit = unitOrder[Math.max(...positions)];
    at.set(unit, [...(at.get(unit) ?? []), { slug: scene.slug, title: scene.title }]);
  }
  return at;
}

export async function getLearningPath(): Promise<LearningPath> {
  const [progress, ...byLevel] = await Promise.all([getProgress(), ...[1, 2, 3, 4, 5].map((l) => getUnits(l))]);
  const withLessons = byLevel.map((units, i) => ({ level: i + 1, units: units.filter((u) => u.lesson_count > 0) }));
  const details = await Promise.all(withLessons.flatMap((l) => l.units.map((u) => getUnit(u.slug))));
  const lessonsBySlug = new Map(details.filter(Boolean).map((u) => [u!.slug, u!.lessons]));

  const order = withLessons.flatMap((l) => l.units.map((u) => u.slug));
  const sceneAt = placeScenes(order, scenes as SceneInfo[]);

  const levels = withLessons
    .filter((l) => l.units.length)
    .map(({ level, units }) => ({
      level,
      ...LEVELS[level],
      units: units.map((u) => ({
        slug: u.slug,
        title: u.title,
        position: u.position,
        level,
        lessons: lessonsBySlug.get(u.slug) ?? [],
        scenes: sceneAt.get(u.slug) ?? [],
      })),
    }));
  return { levels, progress };
}
