import type { MegasoftP2cInput, MegasoftTransactionResult } from './types.js';

import { megasoftCertP2cPayload, megasoftConfig } from '../../config/megasoft.js';
import { megasoftPost } from './megasoftClient.js';
import {
  buildP2cProcessXml,
  buildP2cQueryStatusXml,
  buildPreRegisterXml,
  MEGASOFT_XML,
  parseMegasoftResponseXml,
} from './megasoftXmlTags.js';
import { MegasoftPaymentRejectedError } from './types.js';
import { getXmlTag } from './xml.js';

export function isMegasoftP2cApproved(result: MegasoftTransactionResult): boolean {
  return result.code?.trim() === '00';
}

export async function megasoftPreRegister(): Promise<string> {
  const xml = buildPreRegisterXml(megasoftConfig.affiliationCode);
  const { rawXml } = await megasoftPost('v2-preregistro', xml);

  const control = getXmlTag(rawXml, MEGASOFT_XML.control);
  if (control) return control;

  const plainControl = rawXml.trim();
  if (/^\d+$/.test(plainControl)) return plainControl;

  const description = getXmlTag(rawXml, MEGASOFT_XML.description) ?? 'Error en preregistro';
  throw new MegasoftPaymentRejectedError(description, {
    authId: null,
    code: getXmlTag(rawXml, MEGASOFT_XML.code),
    control: null,
    description,
    rawXml,
    reference: null,
    seqNum: null,
    status: 'R',
    voucher: '',
  });
}

export async function megasoftProcessP2c(
  control: string,
  input: MegasoftP2cInput,
): Promise<MegasoftTransactionResult> {
  const xml = buildP2cProcessXml(
    megasoftConfig.certHardcoded
      ? {
          affiliationCode: megasoftConfig.affiliationCode,
          amount: input.amount,
          clientBankCode: megasoftCertP2cPayload.clientBankCode,
          clientPhone: megasoftCertP2cPayload.clientPhone,
          control,
          invoice: input.invoice,
          merchantBankCode: megasoftCertP2cPayload.merchantBankCode,
          merchantPhone: megasoftCertP2cPayload.merchantPhone,
        }
      : {
          affiliationCode: megasoftConfig.affiliationCode,
          amount: input.amount,
          clientBankCode: input.clientBankCode,
          clientPhone: input.clientPhone,
          control,
          invoice: input.invoice,
          merchantBankCode: megasoftConfig.merchantBankCode,
          merchantCid: megasoftConfig.merchantCid || undefined,
          merchantPhone: megasoftConfig.merchantPhone,
          nationalId: input.nationalId,
          reference: input.reference,
        },
    megasoftConfig.certHardcoded,
  );

  const { rawXml } = await megasoftPost('v2-procesar-compra-p2c', xml);
  return parseMegasoftResponseXml(rawXml, control);
}

export async function megasoftQueryP2cStatus(control: string): Promise<MegasoftTransactionResult> {
  const xml = buildP2cQueryStatusXml(megasoftConfig.affiliationCode, control);
  const { rawXml } = await megasoftPost('v2-querystatus', xml);
  return parseMegasoftResponseXml(rawXml, control);
}

export async function verifyP2cPayment(
  input: MegasoftP2cInput,
): Promise<MegasoftTransactionResult> {
  const control = await megasoftPreRegister();
  const processResult = await megasoftProcessP2c(control, input);

  if (isMegasoftP2cApproved(processResult)) {
    return processResult;
  }

  const statusResult = await megasoftQueryP2cStatus(control);
  if (isMegasoftP2cApproved(statusResult)) {
    return statusResult;
  }

  const finalResult = statusResult.description || statusResult.code ? statusResult : processResult;
  const message = finalResult.description ?? 'Pago rechazado por la plataforma';
  throw new MegasoftPaymentRejectedError(message, finalResult);
}
