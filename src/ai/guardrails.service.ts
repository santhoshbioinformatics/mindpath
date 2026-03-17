// src/ai/guardrails.service.ts
import { Injectable, Logger } from '@nestjs/common';

// ── Phrases never allowed in AI wellness output ──────────────────────────────
const BLOCKED_OUTPUT_PHRASES = [
  'you will be fine',
  'nothing to worry about',
  'just cheer up',
  'others have it worse',
  'snap out of it',
  'stop being so negative',
  'you are diagnosed with',
  'you have depression',
  'you have anxiety disorder',
  'you are bipolar',
  'borderline personality',
  'clinical depression',
  'mental illness',
  'you should take medication',
  'kill yourself',
  'end your life',
  'not worth living',
];

// ── Phrases required in any safety response ──────────────────────────────────
const REQUIRED_IN_CRISIS = ['988', 'support', 'reach out', 'help', 'crisis'];

// ── Question patterns that indicate unsafe intent ────────────────────────────
const UNSAFE_QUESTION_PATTERNS = [
  /how.*(kill|harm|hurt).*(myself|yourself)/i,
  /what.*(pills|dose|overdose)/i,
  /best way to die/i,
  /suicide method/i,
];

@Injectable()
export class GuardrailsService {
  private readonly logger = new Logger(GuardrailsService.name);

  isInsightSafe(text: string): boolean {
    const lower = text.toLowerCase();
    const found = BLOCKED_OUTPUT_PHRASES.find((phrase) => lower.includes(phrase));
    if (found) {
      this.logger.warn(`Blocked phrase detected in insight: "${found}"`);
      return false;
    }
    return true;
  }

  isSafetyResponseSafe(text: string): boolean {
    const lower = text.toLowerCase();
    const hasBlocked = BLOCKED_OUTPUT_PHRASES.some((p) => lower.includes(p));
    if (hasBlocked) return false;
    const hasCrisisContent = REQUIRED_IN_CRISIS.some((p) => lower.includes(p));
    return hasCrisisContent;
  }

  isQuestionUnsafe(question: string): boolean {
    return UNSAFE_QUESTION_PATTERNS.some((pattern) => pattern.test(question));
  }

  sanitizeForDisplay(text: string): string {
    let result = text;
    // Remove accidentally injected clinical labels
    result = result.replace(
      /\b(diagnos\w*|disorder|DSM[\-\s]*\w*|clinical\s+\w+|psychosis|schizophrenia)\b/gi,
      '',
    );
    // Remove markdown artifacts
    result = result.replace(/#{1,6}\s/g, '').replace(/\*\*/g, '').replace(/\*/g, '');
    return result.replace(/\s+/g, ' ').trim();
  }

  // ── Fallback responses ──────────────────────────────────────────────────────

  getFallbackInsight(overallScore: number): {
    title: string;
    body: string;
    suggestedAction: string;
    isRead: boolean;
    generatedAt: Date;
  } {
    const pool = [
      {
        title: 'Keep showing up',
        body: "Every check-in is a small act of self-awareness. Over time, these moments add up to a real picture of your patterns — and that picture becomes your guide.",
        suggestedAction: 'Take one minute to breathe',
      },
      {
        title: 'Progress shows in the data',
        body: "Tracking how you feel — even on hard days — is more valuable than it seems. You're building data that will help you understand yourself better.",
        suggestedAction: 'Set tomorrow\'s check-in reminder',
      },
      {
        title: 'You checked in today',
        body: "That counts for something. Whether today was easy or hard, you showed up and that matters.",
        suggestedAction: 'Notice one thing going well',
      },
    ];

    if (overallScore < 40) {
      pool.push({
        title: 'Difficult days are data too',
        body: "Today looks like a tough one. Low scores are still valuable information — they help identify what makes things harder and what brings you back up.",
        suggestedAction: 'Reach out to someone you trust',
      });
    }

    const fallback = pool[Math.floor(Math.random() * pool.length)];
    return { ...fallback, isRead: false, generatedAt: new Date() };
  }

  getCrisisMessage(severity: string): string {
    const messages: Record<string, string> = {
      critical:
        "We're deeply concerned about how you're feeling right now. Please call or text 988 — trained counselors are available 24/7, and they want to hear from you. If you're in immediate danger, please call 911 or go to your nearest emergency room.",
      high:
        "It sounds like things are really difficult right now. That takes courage to share. Please consider reaching out to someone you trust, or call 988 if you need immediate support. We're here with you.",
      moderate:
        "We noticed you may be going through something hard. Support is available — the Crisis Text Line (text HOME to 741741) and 988 are both free, confidential, and available whenever you need them.",
      low:
        "Thank you for sharing how you're feeling. If things get harder, please remember that 988 is always available — call or text, 24 hours a day.",
    };
    return messages[severity] ?? messages.low;
  }

  // ── AI output schema validation ─────────────────────────────────────────────

  validateInsightShape(obj: unknown): obj is { title: string; body: string; suggestedAction: string } {
    if (typeof obj !== 'object' || !obj) return false;
    const o = obj as Record<string, unknown>;
    return (
      typeof o.title === 'string' && o.title.length > 0 && o.title.length <= 80 &&
      typeof o.body === 'string' && o.body.length > 10 && o.body.length <= 400 &&
      typeof o.suggestedAction === 'string' && o.suggestedAction.length > 0
    );
  }

  validateWeeklyShape(obj: unknown): obj is { narrative: string; highlights: string[]; concerns: string[]; suggestions: string[] } {
    if (typeof obj !== 'object' || !obj) return false;
    const o = obj as Record<string, unknown>;
    return (
      typeof o.narrative === 'string' && o.narrative.length > 20 &&
      Array.isArray(o.highlights) &&
      Array.isArray(o.concerns) &&
      Array.isArray(o.suggestions)
    );
  }
}
