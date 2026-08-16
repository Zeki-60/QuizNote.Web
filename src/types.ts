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
}

/** Soru kartının yanındaki bilgi kartı: aktif kapsamdaki seviye dağılımı ve favori sayısı. */
export interface ScopeStats {
  totalQuestions: number;
  /** Index'i seviye (0-5), değeri o seviyedeki soru sayısı. */
  levelCounts: number[];
  favoriteCount: number;
  /** 0-100 aralığında, kapsamdaki soruların seviye ortalamasından hesaplanan başarı puanı. */
  scorePercent: number;
}

/** Düzenleme ekranındaki şık: doğru/yanlış bilgisi dahil, havuzdaki TÜM şıklar. */
export interface ChoiceEdit {
  id: string;
  text: string;
  isCorrect: boolean;
  orderIndex: number;
}

/** Düzenleme ekranı için soru: tüm şıklar ve bağlı notun tam içeriğiyle. */
export interface QuestionEdit {
  id: string;
  topicId: string;
  type: QuestionTypeValue;
  text: string;
  isNegative: boolean;
  explanation: string | null;
  orderIndex: number;
  noteId: string;
  noteTitle: string;
  noteBody: string;
  choices: ChoiceEdit[];
}

/** Yeni soru eklerken gönderilen tek bir şık: metin + doğru/yanlış bilgisi. */
export interface NewChoiceInput {
  text: string;
  isCorrect: boolean;
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
