/** Tags are stored as canonical hashtags in notes so encrypted imports/backups retain them. */
export function transactionTags(note: string | null | undefined): string[] {
  return [...new Set((note?.match(/#[\p{L}\p{N}_-]+/gu) ?? []).map(tag => tag.slice(1).toLowerCase()))];
}
export function taggedNote(note: string, input: string): string {
  const tags = input.split(/[\s,]+/).filter(Boolean).map(t => t.replace(/^#/, "").toLowerCase());
  if (tags.some(t => !/^[\p{L}\p{N}_-]{1,40}$/u.test(t)) || tags.length > 20) throw new Error("Use up to 20 tags, with letters, numbers, hyphens or underscores.");
  const existing = transactionTags(note);
  const result = [note.trim(), ...[...new Set(tags)].filter(t => !existing.includes(t)).map(t => `#${t}`)].filter(Boolean).join(" ");
  if (result.length > 200) throw new Error("Note and tags together must fit within 200 characters.");
  return result;
}