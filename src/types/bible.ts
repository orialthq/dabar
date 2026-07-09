export interface BookMeta {
  id: string;
  name: string;
  abbr: string;
  testament: "OT" | "NT";
  chapters: number;
}

/** chapters[장-1][절-1] = 절 본문 (개역한글 원문, 무변형) */
export interface BookData {
  id: string;
  name: string;
  chapters: string[][];
}

export interface SearchHit {
  book: BookMeta;
  chapter: number;
  verse: number;
  text: string;
}
