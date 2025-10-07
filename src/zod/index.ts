import { z } from 'zod';
import type { ToJsonSchemaPlugin } from '../shared/protocol';
import type { JsonSchemaType } from '@enth/mcp-specs';

export class ZodToJsonSchemaPlugin implements ToJsonSchemaPlugin<z.ZodType> {
    isValidSchema(schema: object): schema is z.ZodType {
        return schema instanceof z.ZodType;
    }
    toJsonSchema<T>(schema: z.ZodType): JsonSchemaType<T> {
        return z.toJSONSchema(schema, {
            target: 'draft-7',
            unrepresentable: 'throw'
        }) as JsonSchemaType<T>;
    }
}
