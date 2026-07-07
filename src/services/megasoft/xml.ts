export function buildXmlRequest(fields: Record<string, string>): string {
  const body = Object.entries(fields)
    .map(([key, value]) => `<${key}>${escapeXml(value)}</${key}>`)
    .join('');
  return `<request>${body}</request>`;
}

export function buildXmlRequestOrdered(fields: ReadonlyArray<readonly [string, string]>): string {
  const body = fields.map(([key, value]) => `<${key}>${escapeXml(value)}</${key}>`).join('');
  return `<request>${body}</request>`;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function formatVoucherFromXml(xml: string): string {
  const voucherBlock = getXmlTag(xml, 'voucher');
  if (!voucherBlock) return '';

  const fromLineas = getXmlLineas(voucherBlock);
  if (fromLineas.length > 0) return normalizeVoucherText(fromLineas.join('\n'));

  return normalizeVoucherText(voucherBlock.replace(/_/g, ' '));
}

export function getXmlLineas(xml: string): string[] {
  const lines: string[] = [];
  const re = /<linea>([\s\S]*?)<\/linea>/gi;
  let match = re.exec(xml);
  while (match) {
    const text = match[1].replace(/_/g, ' ').trim();
    if (text) lines.push(text);
    match = re.exec(xml);
  }
  return lines;
}

export function getXmlTag(xml: string, tag: string): null | string {
  const cdata = new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i');
  const cdataMatch = xml.match(cdata);
  if (cdataMatch) return cdataMatch[1].trim();

  const plain = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
  const plainMatch = xml.match(plain);
  if (!plainMatch) return null;
  return plainMatch[1].replace(/^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/i, '$1').trim();
}

export function normalizeVoucherText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}
