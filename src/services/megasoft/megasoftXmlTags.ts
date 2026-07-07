import type { MegasoftTransactionResult } from './types.js';

import { buildXmlRequest, buildXmlRequestOrdered, formatVoucherFromXml, getXmlTag } from './xml.js';

/** Megasoft Payment Gateway XML tag names (Spanish — required by their API). */
export const MEGASOFT_XML = {
  affiliationCode: 'cod_afiliacion',
  amount: 'amount',
  authId: 'authid',
  clientBankCode: 'codigobancoCliente',
  clientPhone: 'telefonoCliente',
  code: 'codigo',
  control: 'control',
  description: 'descripcion',
  invoice: 'factura',
  merchantBankCode: 'codigobancoComercio',
  merchantCid: 'cidComercio',
  merchantPhone: 'telefonoComercio',
  nationalId: 'cid',
  reference: 'referencia',
  seqNum: 'seqnum',
  status: 'estado',
  transactionType: 'tipotrx',
  version: 'version',
  voucher: 'voucher',
} as const;

export interface P2cProcessPayload {
  affiliationCode: string;
  amount: number;
  clientBankCode: string;
  clientPhone: string;
  control: string;
  invoice: string;
  merchantBankCode: string;
  merchantCid?: string;
  merchantPhone: string;
  nationalId?: string;
  reference?: string;
}

export function buildP2cProcessXml(payload: P2cProcessPayload, certHardcoded: boolean): string {
  const amount = payload.amount.toFixed(2);

  if (certHardcoded) {
    return buildXmlRequestOrdered([
      [MEGASOFT_XML.affiliationCode, payload.affiliationCode],
      [MEGASOFT_XML.control, payload.control],
      [MEGASOFT_XML.clientPhone, payload.clientPhone],
      [MEGASOFT_XML.clientBankCode, payload.clientBankCode],
      [MEGASOFT_XML.merchantPhone, payload.merchantPhone],
      [MEGASOFT_XML.merchantBankCode, payload.merchantBankCode],
      [MEGASOFT_XML.amount, amount],
      [MEGASOFT_XML.invoice, payload.invoice],
    ]);
  }

  const fields: Array<readonly [string, string]> = [
    [MEGASOFT_XML.affiliationCode, payload.affiliationCode],
    [MEGASOFT_XML.control, payload.control],
    [MEGASOFT_XML.clientPhone, payload.clientPhone],
    [MEGASOFT_XML.clientBankCode, payload.clientBankCode],
    [MEGASOFT_XML.nationalId, payload.nationalId ?? ''],
    [MEGASOFT_XML.reference, payload.reference ?? ''],
    [MEGASOFT_XML.merchantPhone, payload.merchantPhone],
    ...(payload.merchantCid ? ([[MEGASOFT_XML.merchantCid, payload.merchantCid]] as const) : []),
    [MEGASOFT_XML.merchantBankCode, payload.merchantBankCode],
    [MEGASOFT_XML.amount, amount],
    [MEGASOFT_XML.invoice, payload.invoice],
  ];

  return buildXmlRequestOrdered(fields);
}

export function buildP2cQueryStatusXml(affiliationCode: string, control: string): string {
  return buildXmlRequest({
    [MEGASOFT_XML.affiliationCode]: affiliationCode,
    [MEGASOFT_XML.control]: control,
    [MEGASOFT_XML.transactionType]: 'P2C',
    [MEGASOFT_XML.version]: '3',
  });
}

export function buildPreRegisterXml(affiliationCode: string): string {
  return buildXmlRequest({
    [MEGASOFT_XML.affiliationCode]: affiliationCode,
  });
}

export function parseMegasoftResponseXml(
  rawXml: string,
  control: null | string,
): MegasoftTransactionResult {
  const voucher = formatVoucherFromXml(rawXml);
  return {
    authId: getXmlTag(rawXml, MEGASOFT_XML.authId),
    code: getXmlTag(rawXml, MEGASOFT_XML.code),
    control: getXmlTag(rawXml, MEGASOFT_XML.control) ?? control,
    description: getXmlTag(rawXml, MEGASOFT_XML.description),
    rawXml,
    reference: getXmlTag(rawXml, MEGASOFT_XML.reference),
    seqNum: getXmlTag(rawXml, MEGASOFT_XML.seqNum),
    status: getXmlTag(rawXml, MEGASOFT_XML.status),
    voucher,
  };
}

export function redactMegasoftXml(xml: string): string {
  return xml
    .replace(
      new RegExp(`<${MEGASOFT_XML.nationalId}>([\\s\\S]*?)</${MEGASOFT_XML.nationalId}>`, 'gi'),
      `<${MEGASOFT_XML.nationalId}>***</${MEGASOFT_XML.nationalId}>`,
    )
    .replace(
      new RegExp(`<${MEGASOFT_XML.merchantCid}>([\\s\\S]*?)</${MEGASOFT_XML.merchantCid}>`, 'gi'),
      `<${MEGASOFT_XML.merchantCid}>***</${MEGASOFT_XML.merchantCid}>`,
    )
    .replace(
      new RegExp(`<${MEGASOFT_XML.clientPhone}>([\\s\\S]*?)</${MEGASOFT_XML.clientPhone}>`, 'gi'),
      `<${MEGASOFT_XML.clientPhone}>***</${MEGASOFT_XML.clientPhone}>`,
    )
    .replace(
      new RegExp(
        `<${MEGASOFT_XML.merchantPhone}>([\\s\\S]*?)</${MEGASOFT_XML.merchantPhone}>`,
        'gi',
      ),
      `<${MEGASOFT_XML.merchantPhone}>***</${MEGASOFT_XML.merchantPhone}>`,
    );
}
