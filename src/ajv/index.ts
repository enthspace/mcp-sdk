import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';

import { schemas } from '@enth/mcp-specs/draft/schemas';
import type { JsonSchemaType, JsonSchemaValidator, JsonSchemaValidatorResult } from '@enth/mcp-specs';
import type { JsonSchemaValidatorProvider } from '../shared/protocol';

export class AjvJsonSchemaValidatorProvider implements JsonSchemaValidatorProvider {
    private _ajv: InstanceType<typeof Ajv>;

    constructor(ajv?: InstanceType<typeof Ajv>) {
        if (ajv) {
            this._ajv = ajv;
        } else {
            const newAjv = new Ajv({ strict: false, schemas });
            addFormats(newAjv);
            this._ajv = newAjv;
        }
    }

    getValidator<T>(schema: JsonSchemaType<T>): JsonSchemaValidator<T> {
        const ajvValidator =
            '$id' in schema && typeof schema.$id === 'string'
                ? (this._ajv.getSchema<T>(schema.$id!) ?? this._ajv.compile<T>(schema))
                : this._ajv.compile<T>(schema);
        return (input: unknown): JsonSchemaValidatorResult<T> => {
            const valid = ajvValidator(input);
            if (valid) {
                return {
                    valid: true,
                    data: input as T,
                    errorMessage: undefined
                };
            } else {
                return {
                    valid: false,
                    data: undefined,
                    errorMessage: this._ajv.errorsText(ajvValidator.errors)
                };
            }
        };
    }
}
