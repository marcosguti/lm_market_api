import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LOGO_CONTENT_ID = 'lm-market-logo';
export const LOGO_FILENAME = 'logo.png';

const logoPath = path.join(path.dirname(fileURLToPath(import.meta.url)), LOGO_FILENAME);
const logoBase64 = readFileSync(logoPath).toString('base64');

export const getLogoInlineAttachment = (): {
  Base64Content: string;
  ContentID: string;
  ContentType: string;
  Filename: string;
} => ({
  Base64Content: logoBase64,
  ContentID: LOGO_CONTENT_ID,
  ContentType: 'image/png',
  Filename: LOGO_FILENAME,
});
