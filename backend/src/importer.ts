import { parse } from 'csv-parse/sync';
import { curriculumSchema } from '@unipath/shared';
export function guardDepth(value: unknown, depth = 0): void {
  if (depth > 20) throw new Error('Document nesting is too deep.');
  if (Array.isArray(value)) value.forEach((v) => guardDepth(v, depth + 1));
  else if (value && typeof value === 'object')
    Object.values(value).forEach((v) => guardDepth(v, depth + 1));
}
export function importCurriculum(format: 'json' | 'csv', content: string, metadata?: unknown) {
  let input: unknown;
  if (format === 'json') input = JSON.parse(content);
  else {
    if (!metadata || typeof metadata !== 'object')
      throw new Error('CSV imports require curriculum metadata.');
    const rows = parse(content, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: true,
      max_record_size: 16000,
    }) as Record<string, string>[];
    if (!rows.length || rows.length > 300) throw new Error('Import 1–300 courses.');
    const allowed = [
      'code',
      'title',
      'credits',
      'semester',
      'category',
      'electiveGroup',
      'description',
      'requirement',
      'sources',
    ];
    if (Object.keys(rows[0]).some((k) => !allowed.includes(k)))
      throw new Error('CSV has unsupported columns.');
    const courses = rows.map((row) => ({
      code: row.code,
      title: row.title,
      credits: Number(row.credits),
      semester: Number(row.semester),
      category: row.category,
      electiveGroup: row.electiveGroup || null,
      description: row.description || null,
      requirement: row.requirement ? JSON.parse(row.requirement) : null,
      sources: row.sources ? JSON.parse(row.sources) : [],
    }));
    input = { ...metadata, courses };
  }
  guardDepth(input);
  return curriculumSchema.parse(input);
}
