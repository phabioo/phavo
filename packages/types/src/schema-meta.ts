import { z } from 'zod';

export type SchemaMeta = {
  credential?: boolean;
  label?: string;
  testEndpoint?: string;
};

export const PRESERVE_CREDENTIAL_VALUE = '__PHAVO_KEEP_CREDENTIAL__';
export const MASKED_CREDENTIAL_DISPLAY = '••••••';

const META_SYMBOL = Symbol.for('phavo.zod.schemaMeta');

type ZodTypeWithMeta = z.ZodTypeAny & {
  [META_SYMBOL]?: SchemaMeta;
  meta: {
    (): SchemaMeta | undefined;
    (meta: SchemaMeta): z.ZodTypeAny;
  };
};

declare module 'zod' {
  interface ZodTypeDef {
    [META_SYMBOL]?: SchemaMeta;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Zod module augmentation must match the library declaration exactly.
  interface ZodType<Output = any, Def extends ZodTypeDef = ZodTypeDef, Input = Output> {
    meta(): SchemaMeta | undefined;
    meta(meta: SchemaMeta): this;
  }
}

export function ensureZodMetaCompat(): void {
  const proto = z.ZodType.prototype as ZodTypeWithMeta;
  if (typeof proto.meta === 'function') return;

  Object.defineProperty(proto, 'meta', {
    value(this: ZodTypeWithMeta, meta?: SchemaMeta) {
      if (meta === undefined) {
        return this[META_SYMBOL];
      }

      this[META_SYMBOL] = {
        ...(this[META_SYMBOL] ?? {}),
        ...meta,
      };

      return this;
    },
    configurable: true,
    enumerable: false,
    writable: true,
  });
}

ensureZodMetaCompat();

export function getSchemaMeta(schema: z.ZodTypeAny): SchemaMeta {
  ensureZodMetaCompat();
  return (schema as ZodTypeWithMeta).meta?.() ?? {};
}

export function isCredentialField(schema: z.ZodTypeAny): boolean {
  return getSchemaMeta(schema).credential === true;
}
