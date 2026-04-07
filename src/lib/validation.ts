import vagueWordsConfig from "@/config/vague-words.json";

export const MIN_CHAR_COUNT = 10;

export function checkMinLength(value: string, min = MIN_CHAR_COUNT): string | null {
  if (!value || value.trim().length < min) {
    return `Consider expanding this field (currently ${value?.trim().length ?? 0} characters).`;
  }
  return null;
}

export function checkVagueWords(value: string): string | null {
  const lower = value.toLowerCase();
  const words = lower.match(/\b\w+\b/g) ?? [];
  const found = words.filter((w) => vagueWordsConfig.vagueWords.includes(w));
  if (found.length > 0) {
    return `Contains vague or non-descriptive terms: "${found.join('", "')}". Use precise, specific language.`;
  }
  return null;
}

export function validateTextField(
  value: string,
  fieldName: string,
  min = MIN_CHAR_COUNT
): string[] {
  const errors: string[] = [];
  if (!value || value.trim() === "") {
    errors.push(`${fieldName} is required.`);
    return errors;
  }
  const lengthError = checkMinLength(value, min);
  if (lengthError) errors.push(lengthError);
  const vagueError = checkVagueWords(value);
  if (vagueError) errors.push(vagueError);
  return errors;
}

export interface SoftValidationResult {
  warnings: string[];
  isPresent: boolean;
}

export function validateTextFieldSoft(
  value: string,
  fieldName: string,
  min = MIN_CHAR_COUNT
): SoftValidationResult {
  if (!value || value.trim() === "") {
    return { warnings: [`${fieldName} is empty — completing it will strengthen your visualization decisions.`], isPresent: false };
  }
  const warnings: string[] = [];
  const lengthHint = checkMinLength(value, min);
  if (lengthHint) warnings.push(lengthHint);
  const vagueHint = checkVagueWords(value);
  if (vagueHint) warnings.push(vagueHint);
  return { warnings, isPresent: true };
}

export function validateRequired(value: string, fieldName: string): string | null {
  if (!value || value.trim() === "") {
    return `${fieldName} is required.`;
  }
  return null;
}

export function crossCheckEmotionalTone(
  referenceEmotion: string,
  intentAtmosphere: string
): string | null {
  if (!referenceEmotion || !intentAtmosphere) return null;

  const refTokens = referenceEmotion.toLowerCase().match(/\b\w+\b/g) ?? [];
  const intentTokens = intentAtmosphere.toLowerCase().match(/\b\w+\b/g) ?? [];

  const stopWords = new Set(["the", "a", "an", "is", "are", "and", "or", "of", "in", "to", "for", "with", "this", "that"]);
  const filteredRef = refTokens.filter((t) => !stopWords.has(t));
  const filteredIntent = intentTokens.filter((t) => !stopWords.has(t));

  const shared = filteredRef.filter((t) => filteredIntent.includes(t));
  if (shared.length === 0) {
    return `The emotional tone of this reference may not align with the declared intent atmosphere. Review before proceeding.`;
  }
  return null;
}

export function crossCheckVisionTone(
  visionTone: string,
  intentAtmosphere: string
): string | null {
  if (!visionTone || !intentAtmosphere) return null;

  const visionTokens = visionTone.toLowerCase().match(/\b\w+\b/g) ?? [];
  const intentTokens = intentAtmosphere.toLowerCase().match(/\b\w+\b/g) ?? [];

  const stopWords = new Set(["the", "a", "an", "is", "are", "and", "or", "of", "in", "to", "for", "with", "this", "that"]);
  const filteredVision = visionTokens.filter((t) => !stopWords.has(t));
  const filteredIntent = intentTokens.filter((t) => !stopWords.has(t));

  const shared = filteredVision.filter((t) => filteredIntent.includes(t));
  if (shared.length === 0) {
    return `Vision emotional tone may conflict with declared intent atmosphere. Review for consistency.`;
  }
  return null;
}
