import https from 'node:https';
import { URL } from 'node:url';

import { isMegasoftConfigured, megasoftConfig } from '../../config/megasoft.js';
import { redactMegasoftXml } from './megasoftXmlTags.js';
import { MegasoftPlatformError } from './types.js';

export async function megasoftPost(
  action: string,
  xmlBody: string,
): Promise<{ rawXml: string; status: number }> {
  if (megasoftConfig.simulatePlatformDown) {
    throw new MegasoftPlatformError(
      'Detectamos un problema en la plataforma bancaria, intente nuevamente',
      503,
    );
  }

  if (!isMegasoftConfigured()) {
    throw new Error('Megasoft no está configurado');
  }

  const url = `${megasoftConfig.baseUrl}/action/${action}`;
  const credentials = Buffer.from(`${megasoftConfig.user}:${megasoftConfig.password}`).toString(
    'base64',
  );

  if (megasoftConfig.debugLogs) {
    // eslint-disable-next-line no-console
    console.info('[megasoft] request', {
      action,
      payload: redactMegasoftXml(xmlBody),
      url,
      xmlBody,
    });
  }

  let result: { body: string; status: number };
  try {
    result = await httpsPost(url, xmlBody, credentials);
  } catch (error) {
    console.error('[megasoft] network error', {
      action,
      error: error instanceof Error ? error.message : String(error),
      url,
    });
    throw new MegasoftPlatformError(
      'Detectamos un problema en la plataforma bancaria, intente nuevamente',
      503,
    );
  }

  const { body, status } = result;

  if (megasoftConfig.debugLogs) {
    // eslint-disable-next-line no-console
    console.info('[megasoft] response', {
      action,
      body: body.slice(0, 2000),
      status,
      url,
    });
  }

  if (status >= 500) {
    console.error('[megasoft] upstream server error', {
      action,
      body: body.slice(0, 2000),
      status,
      url,
    });
    throw new MegasoftPlatformError(
      'Detectamos un problema en la plataforma bancaria, intente nuevamente',
      status,
    );
  }

  return { rawXml: body, status };
}

function httpsPost(
  url: string,
  body: string,
  basicAuth: string,
): Promise<{ body: string; status: number }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        headers: {
          Accept: 'text/xml, application/xml, */*',
          Authorization: `Basic ${basicAuth}`,
          'Content-Length': Buffer.byteLength(body),
          'Content-Type': 'text/xml',
        },
        hostname: parsed.hostname,
        method: 'POST',
        path: `${parsed.pathname}${parsed.search}`,
        port: parsed.port || 443,
        rejectUnauthorized: !megasoftConfig.tlsInsecure,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            body: Buffer.concat(chunks).toString('utf8'),
            status: res.statusCode ?? 500,
          });
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
