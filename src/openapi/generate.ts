import {Project, PropertySignatureStructure} from 'ts-simple-ast'

import {ensureFile, filePath, Imports} from '../generate/util'
import {API, Definition, resolve, Value, GroupVersionKind} from './'

export default function generate(proj: Project, api: API) {
  let imports: Map<string, Imports> = new Map()

  for (let {name, path, def} of definitions(api)) {
    if (name in elidedTypes) {
      continue
    }

    let file = ensureFile(proj, filePath(path))
    let fileImports = imports.get(file.getFilePath())
    if (fileImports == null) {
      fileImports = new Imports(file)
      imports.set(file.getFilePath(), fileImports)
    }

    if (name in scalarTypes) {
      file.addTypeAlias({
        name,
        isExported: true,
        type: scalarTypes[name],
        docs: def.description ? [{description: def.description}] : [],
      })
    } else {
      file.addInterface({
        name,
        isExported: true,
        properties: properties(proj, api, def, fileImports),
        docs: def.description ? [{description: def.description}] : [],
      })
    }
  }

  for (let fileImports of imports.values()) {
    fileImports.apply()
  }
}

interface ResolvedDefinition {
  name: string
  path: string
  def: Definition
}

export function definitions(api: API): ResolvedDefinition[] {
  let defs = []

  for (let name of Object.keys(api.definitions)) {
    let parsed = parseDefName(name)
    if (parsed == null) {
      continue
    }

    defs.push({...parsed, def: api.definitions[name]})
  }

  return defs
}

export function properties(
  proj: Project,
  api: API,
  {required, properties: props, 'x-kubernetes-group-version-kind': gvk}: Definition,
  imports: Imports
): PropertySignatureStructure[] {
  if (!props) {
    return []
  }

  return Object.keys(props).map(name => {
    let prop = props[name]
    return {
      name,
      type: kindType(gvk, name) || type(proj, api, imports, prop),
      docs: prop.description ? [prop.description] : [],
      hasQuestionToken: !(required || []).includes(name),
      isReadonly: prop.description ? prop.description.includes('Read-only.') : false,
    }
  })
}

export function kindType(
  gvkList: GroupVersionKind[] | undefined,
  propName: string
): string | undefined {
  if (gvkList != null && gvkList.length === 1) {
    const gvk = gvkList[0]
    if (propName === 'apiVersion') {
      return JSON.stringify([gvk.group, gvk.version].filter(Boolean).join('/'))
    } else if (propName === 'kind') {
      return JSON.stringify(gvk.kind)
    }
  }

  return undefined
}

export function type(proj: Project, api: API, imports: Imports, value: Value): string {
  let t = ''

  if ('$ref' in value) {
    let ref = parseDefName(resolve(api, value).name)
    if (ref == null) {
      throw new Error(`Value references excluded type: ${JSON.stringify(value)}`)
    }

    if (ref.name in elidedTypes) {
      t = elidedTypes[ref.name]
    } else {
      imports.add(ensureFile(proj, filePath(ref.path)), ref.name)
      t = ref.name
    }
  } else if ('type' in value) {
    switch (value.type) {
      case 'string':
      case 'number':
      case 'boolean':
        t = value.type
        break
      case 'integer':
        t = 'number'
        break
      case 'object':
        t = `{[name: string]: ${type(proj, api, imports, value.additionalProperties)}}`
        break
      case 'array':
        t = `Array<${type(proj, api, imports, value.items)}>`
        break
      default:
        assertNever(value)
    }
  } else {
    assertNever(value)
  }

  return t
}

const simplifyDefName = (name: string): string | undefined => {
  const simplifications = {
    'io.k8s.api.': '',
    'io.k8s.apimachinery.pkg.apis.': '',
    'io.k8s.apimachinery.pkg.': '',
    'io.k8s.apiextensions-apiserver.pkg.apis.': '',
  }
  for (let [prefix, replacement] of Object.entries(simplifications)) {
    if (name.startsWith(prefix)) {
      return `${replacement}${name.slice(prefix.length)}`
    }
  }

  return undefined
}

export function parseDefName(name: string): {name: string; path: string} | undefined {
  let simplifiedName = simplifyDefName(name)
  if (simplifiedName == null) {
    return undefined
  }
  name = simplifiedName

  let parts = name.split('.')
  name = parts[parts.length - 1]
  let path = parts.slice(0, -1).join('/')

  return {name, path}
}

const elidedTypes: {[name: string]: string} = {
  IntOrString: 'number | string',
}
const scalarTypes: {[name: string]: string} = {
  Quantity: 'string',
  Time: 'string',
  MicroTime: 'string',
  JSONSchemaPropsOrArray: 'JSONSchemaProps | JSONSchemaProps[]',
  JSONSchemaPropsOrBool: 'JSONSchemaProps | boolean',
  JSONSchemaPropsOrStringArray: 'JSONSchemaProps | string[]',
}

const assertNever = (_: never) => {
  throw new Error('"unreachable" code was reached')
}
