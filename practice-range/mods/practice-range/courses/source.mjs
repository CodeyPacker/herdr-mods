import { readRepoSource } from "./repo.mjs";
import { readRepoLessons } from "./supplements.mjs";

/** Resolve only references already present in this enrollment, never a caller-supplied path. */
export async function courseSource(course, directory, request) {
  if (request.repoLessonId !== undefined) {
    const saved = await readRepoLessons(directory);
    if (saved.error) throw new Error(saved.error);
    const lesson = saved.lessons.find(lesson => lesson.id === request.repoLessonId);
    if (!Number.isInteger(request.sectionIndex) || request.sectionIndex < 0 || !Number.isInteger(request.referenceIndex) || request.referenceIndex < 0) throw new Error("Choose a saved source reference.");
    const ref = lesson?.sections[request.sectionIndex]?.references[request.referenceIndex];
    if (!ref) throw new Error("Choose a saved source reference.");
    return readRepoSource(directory, { ...ref, commit: lesson.commit }, ref.code, request.line);
  }
  const lesson = course.lessons.find(lesson => lesson.id === request.moduleId);
  const example = lesson?.examples[request.exampleId];
  if (!example?.repoRef) throw new Error("Choose a repo example from this course.");
  return readRepoSource(directory, example.repoRef, example.sourceError ? null : example.code, request.line);
}
