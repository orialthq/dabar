/** 성경 구절 참조. 본문 텍스트는 저장하지 않고 항상 로컬 성경 DB에서 해석한다 (단일 원천). */
export interface VerseRef {
  bookId: string;
  chapter: number;
  verse: number;
}

export interface Entry {
  id: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  title: string;
  body: string;
  verses: VerseRef[];
}

export interface Draft {
  title: string;
  body: string;
  verses: VerseRef[];
}
