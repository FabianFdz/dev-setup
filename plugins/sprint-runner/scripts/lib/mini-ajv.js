'use strict';
/**
 * Minimal, dependency-free JSON Schema validator.
 *
 * Supports exactly the subset used by schemas/handoff.schema.json and
 * schemas/status.schema.json: type (incl. arrays of types for nullable
 * fields), enum, required, properties, additionalProperties: false,
 * propertyNames.pattern, $ref to "#/$defs/x", minimum, and format:
 * "date-time". Not a general-purpose validator — if a schema file starts
 * using something outside this list, extend it here.
 *
 * Returns an array of human-readable error strings (empty = valid).
 */

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value; // 'number' | 'string' | 'boolean' | 'object'
}

function matchesType(value, type) {
  const actual = typeOf(value);
  if (type === 'number') return actual === 'number' || actual === 'integer';
  return actual === type;
}

function isDateTime(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function resolveRef(ref, root) {
  // Only supports "#/$defs/<name>".
  const m = /^#\/\$defs\/(.+)$/.exec(ref);
  if (!m || !root.$defs || !root.$defs[m[1]]) {
    throw new Error(`mini-ajv: unsupported or missing $ref "${ref}"`);
  }
  return root.$defs[m[1]];
}

function validateNode(value, schema, root, path, errors) {
  if (schema.$ref) {
    validateNode(value, resolveRef(schema.$ref, root), root, path, errors);
    return;
  }

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) {
      errors.push(`${path || '(root)'} must be ${types.join(' or ')}, got ${typeOf(value)}`);
      return; // further checks would be meaningless
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path || '(root)'} must be one of [${schema.enum.join(', ')}], got ${JSON.stringify(value)}`);
  }

  if (schema.format === 'date-time' && typeof value === 'string' && !isDateTime(value)) {
    errors.push(`${path || '(root)'} is not a valid date-time: "${value}"`);
  }

  if (typeof schema.minimum === 'number' && typeof value === 'number' && value < schema.minimum) {
    errors.push(`${path || '(root)'} must be >= ${schema.minimum}, got ${value}`);
  }

  if (schema.type === 'object' && value && typeof value === 'object' && !Array.isArray(value)) {
    const declaredProps = schema.properties ? Object.keys(schema.properties) : [];

    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in value)) errors.push(`${path || '(root)'} missing required property "${key}"`);
      }
    }

    if (schema.properties) {
      for (const [key, subSchema] of Object.entries(schema.properties)) {
        if (key in value) validateNode(value[key], subSchema, root, path ? `${path}.${key}` : key, errors);
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!declaredProps.includes(key)) errors.push(`${path || '(root)'} has unexpected property "${key}"`);
      }
    } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      for (const key of Object.keys(value)) {
        if (!declaredProps.includes(key)) {
          if (schema.propertyNames?.pattern && !new RegExp(schema.propertyNames.pattern).test(key)) {
            errors.push(`${path || '(root)'} key "${key}" does not match pattern ${schema.propertyNames.pattern}`);
            continue;
          }
          validateNode(value[key], schema.additionalProperties, root, path ? `${path}.${key}` : key, errors);
        }
      }
    }
  }
}

/** Validates `data` against `schema`. Returns an array of error strings (empty = valid). */
function validate(data, schema) {
  const errors = [];
  validateNode(data, schema, schema, '', errors);
  return errors;
}

module.exports = { validate };
