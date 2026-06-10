import { readFile } from 'node:fs/promises';

const { PROJECT_REF, SUPABASE_ACCESS_TOKEN } = process.env;

if (!PROJECT_REF || !SUPABASE_ACCESS_TOKEN) {
  console.error('Missing PROJECT_REF or SUPABASE_ACCESS_TOKEN.');
  console.error('Usage: SUPABASE_ACCESS_TOKEN=... PROJECT_REF=... npm run supabase:update-recovery-template');
  process.exit(1);
}

const templatePath = new URL('../supabase/templates/recovery.html', import.meta.url);
const rawTemplate = await readFile(templatePath, 'utf8');
const template = rawTemplate
  .replace(/^\s*```(?:html)?\s*/i, '')
  .replace(/\s*```\s*$/i, '')
  .trim();

if (!template.startsWith('<!doctype html>')) {
  console.error('Refusing to upload recovery template because it does not start with <!doctype html>.');
  process.exit(1);
}

if (template.includes('```')) {
  console.error('Refusing to upload recovery template because it still contains Markdown code fence markers.');
  process.exit(1);
}

const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    mailer_subjects_recovery: 'Reset Your Tea Time Cari Password',
    mailer_templates_recovery_content: template,
  }),
});

if (!response.ok) {
  console.error(`Failed to update Supabase recovery template: ${response.status} ${response.statusText}`);
  console.error(await response.text());
  process.exit(1);
}

console.log('Supabase recovery email template updated. Send a fresh reset email to test the new one-time link.');
