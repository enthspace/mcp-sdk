import { toJsonSchema as valibotToJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';
import type { ToJsonSchemaPlugin } from '../shared/protocol';
import type { JsonSchemaType } from '@enth/mcp-specs';

export class ValibotToJsonSchemaPlugin implements ToJsonSchemaPlugin<v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>> {
    isValidSchema(schema: object): schema is v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>> {
        return (
            'kind' in schema &&
            typeof schema.kind === 'string' &&
            'type' in schema &&
            typeof schema.type === 'string' &&
            'reference' in schema &&
            typeof schema.reference === 'function'
        );
    }
    toJsonSchema<T>(schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>): JsonSchemaType<T> {
        return valibotToJsonSchema(schema) as JsonSchemaType<T>;
    }
}
