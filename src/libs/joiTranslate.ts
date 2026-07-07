type JoiErrorDetail = {
  context?: Record<string, unknown>;
  type: string;
};

const LABELS: Record<string, string> = {
  'alternatives.match': 'no coincide con ninguna alternativa válida',
  'any.invalid': 'contiene un valor inválido',
  'any.only': 'debe ser uno de los valores permitidos',
  'any.required': 'es requerido',
  'array.base': 'debe ser un arreglo',
  'array.items': 'el elemento tiene un formato inválido',
  'array.max': 'debe tener como máximo {#limit} elementos',
  'array.min': 'debe tener al menos {#limit} elementos',
  'boolean.base': 'debe ser un booleano',
  'date.base': 'debe ser una fecha válida',
  'date.iso': 'debe estar en formato ISO',
  'date.max': 'debe ser igual o anterior a {#limit}',
  'date.min': 'debe ser igual o posterior a {#limit}',
  'number.base': 'debe ser un número',
  'number.integer': 'debe ser un número entero',
  'number.max': 'debe ser como máximo {#limit}',
  'number.min': 'debe ser al menos {#limit}',
  'number.positive': 'debe ser un número positivo',
  'object.base': 'debe ser un objeto',
  'object.max': 'debe tener como máximo {#limit} claves',
  'object.min': 'debe tener al menos {#limit} claves',
  'object.unknown': 'tiene claves no permitidas',
  'string.alphanum': 'solo puede contener letras y números',
  'string.base': 'debe ser una cadena de texto',
  'string.email': 'debe ser un email válido',
  'string.empty': 'no puede estar vacío',
  'string.guid': 'debe ser un UUID válido',
  'string.length': 'debe tener exactamente {#limit} caracteres',
  'string.max': 'debe tener como máximo {#limit} caracteres',
  'string.min': 'debe tener al menos {#limit} caracteres',
  'string.pattern.base': 'tiene un formato inválido',
  'string.uri': 'debe ser una URL válida',
};

type JoiContext = { label?: unknown } & Record<string, unknown>;

/**
 * Translate an array of Joi error details to a single Spanish message.
 */
export function translateJoiDetails(details: JoiErrorDetail[]): string {
  if (details.length === 0) return 'Datos inválidos';
  if (details.length === 1) return translateJoiError(details[0]);
  const messages = details.map(translateJoiError);
  return messages.join('; ');
}

/**
 * Translate a single Joi error detail to a human-readable Spanish message.
 */
export function translateJoiError(detail: JoiErrorDetail): string {
  const ctx = detail.context as JoiContext | undefined;
  const label = ctx?.label;
  const key = describeKey(label);

  // any.required often comes without a useful context; use the field name
  if (detail.type === 'any.required') {
    return `${key} es requerido`;
  }

  // string.empty often means "is required" when .required() but no value provided
  if (detail.type === 'string.empty' && ctx?.value === '') {
    return `${key} es requerido`;
  }

  const template = LABELS[detail.type];
  if (!template) {
    // Fallback: return the key with a generic message
    return `${key} es inválido`;
  }

  return `${key} ${interpolate(template, ctx as Record<string, unknown>)}`;
}

function describeKey(label: unknown): string {
  if (!label) return 'el campo';
  return `"${label}"`;
}

function interpolate(template: string, context: Record<string, unknown> | undefined): string {
  if (!context) return template;
  return template.replace(/{#(\w+)}/g, (_, key) => {
    const value = context[key];
    if (value === undefined || value === null) return '';
    return String(value);
  });
}
