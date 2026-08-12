export const QuestionType = {
  MultipleChoice: 0,
  Matching: 1,
  TrueFalse: 2,
} as const;

export type QuestionTypeValue = (typeof QuestionType)[keyof typeof QuestionType];

export interface AuthResponse {
  token: string;
  userId: string;
  email: string;
  displayName: string;
}

export interface Topic {
  id: string;
  name: string;
  description: string | null;
  questionCount: number;
}

export interface Note {
  id: string;
  topicId: string;
  title: string;
  body: string;
}

export interface Choice {
  id: string;
  text: string;
}

export interface MatchLeft {
  id: string;
  leftText: string;
}

export interface MatchRight {
  id: string;
  rightText: string;
}

export interface Question {
  id: string;
  type: QuestionTypeValue;
  text: string;
  orderIndex: number;
  noteId: string;
  noteTitle: string;
  choices: Choice[];
  matchLefts: MatchLeft[];
  matchRights: MatchRight[];
  /** Kullanıcının bu sorudaki seviyesi (0-5), yıldızlarla gösterilir. */
  level: number;
  maxLevel: number;
  /** Kullanıcı bu soruyu favorilere eklemiş mi? */
  isFavorite: boolean;
  /** Kullanıcı bu soruyu pasif (aktif olmayan) olarak işaretlemiş mi? */
  isInactive: boolean;
}

/** Soru kartının yanındaki bilgi kartı: aktif kapsamdaki seviye dağılımı, favori ve pasif sayıları. */
export interface ScopeStats {
  totalQuestions: number;
  /** Index'i seviye (0-5), değeri o seviyedeki soru sayısı. */
  levelCounts: number[];
  favoriteCount: number;
  inactiveCount: number;
}

export interface AnswerResult {
  isCorrect: boolean;
  explanation: string | null;
  correctChoiceId: string | null;
  correctPairs: Record<string, string> | null;
  note: Note;
  /** Cevaptan sonraki yeni seviye; giriş yapılmamışsa null. */
  level: number | null;
  previousLevel: number | null;
  maxLevel: number;
}
