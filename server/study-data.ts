import { readDb, writeDb, type DatabaseState, type FolderRecord } from "./store";

type StudyRows = Pick<DatabaseState, "studySets" | "cards" | "studyGuides" | "quizAttempts" | "generationJobs"> & {
  folders: FolderRecord[];
};

// Open a fresh scope for each synchronous read/modify/write. Cards inherit ownership from their deck.
export function openStudyData(userId: string) {
  if (!userId) throw new Error("Study data requires a user.");
  const allRows = readDb();
  const owns = (row: { userId: string }) => row.userId === userId;
  const ownedSets = allRows.studySets.filter(owns);
  const ownedSetIds = new Set(ownedSets.map((set) => set.id));
  const data: StudyRows = {
    folders: (allRows.folders ?? []).filter(owns),
    studySets: ownedSets,
    cards: allRows.cards.filter((card) => ownedSetIds.has(card.setId)),
    studyGuides: allRows.studyGuides.filter(owns),
    quizAttempts: allRows.quizAttempts.filter(owns),
    generationJobs: allRows.generationJobs.filter(owns),
  };

  function merge<T extends { id: string }>(outside: T[], inside: T[]): T[] {
    const ids = new Set(outside.map((row) => row.id));
    for (const row of inside) {
      if (ids.has(row.id)) throw new Error("Duplicate study record ID.");
      ids.add(row.id);
    }
    return [...outside, ...inside];
  }

  return {
    data,
    save() {
      const setIds = new Set(data.studySets.map((set) => set.id));
      const folderIds = new Set(data.folders.map((folder) => folder.id));
      const studyItems = [...data.studySets, ...data.studyGuides];
      const ownerRows = [...studyItems, ...data.folders, ...data.quizAttempts, ...data.generationJobs];
      if (!ownerRows.every(owns) ||
          studyItems.some((item) => item.folderId != null && !folderIds.has(item.folderId)) ||
          data.cards.some((card) => !setIds.has(card.setId)) ||
          data.studyGuides.some((guide) => guide.setId !== null && !setIds.has(guide.setId)) ||
          data.quizAttempts.some((attempt) => !setIds.has(attempt.setId))) {
        throw new Error("Study record is outside the current user's scope.");
      }
      writeDb({
        ...allRows,
        folders: merge((allRows.folders ?? []).filter((row) => !owns(row)), data.folders),
        studySets: merge(allRows.studySets.filter((row) => !owns(row)), data.studySets),
        cards: merge(allRows.cards.filter((card) => !ownedSetIds.has(card.setId)), data.cards),
        studyGuides: merge(allRows.studyGuides.filter((row) => !owns(row)), data.studyGuides),
        quizAttempts: merge(allRows.quizAttempts.filter((row) => !owns(row)), data.quizAttempts),
        generationJobs: merge(allRows.generationJobs.filter((row) => !owns(row)), data.generationJobs),
      });
    },
  };
}

