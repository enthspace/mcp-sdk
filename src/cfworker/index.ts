import type { SchemaDraft as CfWorkerSchemaDraft, Schema as CfWorkerSchema } from '@cfworker/json-schema';
import { Validator } from '@cfworker/json-schema';
import type { JsonSchemaValidatorProvider } from '../shared/protocol';
import type { JsonSchemaType, JsonSchemaValidator, JsonSchemaValidatorResult } from '@enth/mcp-specs';
import { schemas } from '@enth/mcp-specs/draft/schemas';

export class CfWorkerJsonSchemaValidatorProvider implements JsonSchemaValidatorProvider {
    shortcircuit: boolean;
    includeMcpSchemas: boolean;
    draft: CfWorkerSchemaDraft;

    constructor(options?: { shortcircuit?: boolean; includeMcpSchemas?: boolean; draft?: CfWorkerSchemaDraft }) {
        this.shortcircuit = options?.shortcircuit ?? true;
        this.includeMcpSchemas = options?.includeMcpSchemas ?? true;
        this.draft = options?.draft ?? '7';
    }

    getValidator<T>(schema: JsonSchemaType<T>): JsonSchemaValidator<T> {
        // CFWorker's JSON Schema validator requires the schema to be a full Schema object, not just a JSONSchemaType
        const cfSchema = schema as unknown as CfWorkerSchema;
        const validator = new Validator(cfSchema, this.draft, this.shortcircuit);
        if (this.includeMcpSchemas) {
            for (const otherSchema of Object.values(schemas)) {
                if (otherSchema.$id && otherSchema.$id !== schema.$id) {
                    validator.addSchema(otherSchema as CfWorkerSchema);
                }
            }
        }
        return (input: unknown): JsonSchemaValidatorResult<T> => {
            const result = validator.validate(input);
            if (result.valid) {
                return {
                    valid: true,
                    data: input as T,
                    errorMessage: undefined
                };
            } else {
                return {
                    valid: false,
                    data: undefined,
                    errorMessage: result.errors.map(err => `${err.instanceLocation} ${err.error}`).join(', ')
                };
            }
        };
    }
}
