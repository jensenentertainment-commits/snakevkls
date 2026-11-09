// These requests ask for evidence/details, not a new product identity.
export function isRoyEvidenceFollowUp(question: string): boolean {
  return /datagrunnlag.*(?:dette|det|disse)|hvor kommer (?:disse |de |)tallene fra|når ble (?:dette|det|den|produktet) sist oppdatert|^(?:kan du |vil du |)utdype[?.!\s]*$/iu.test(question.trim());
}
