import {Project, PropertySignatureStructure} from 'ts-simple-ast'

import {ensureFile, Imports} from '../generate/util'
import {API, Definition, resolve, Value} from './'

export default function generate(proj: Project, api: API) {
  let imports: Map<string, Imports> = new Map()

  for (let {name, path, def} of definitions(api)) {
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
  {required, properties: props}: Definition,
  imports: Imports
): PropertySignatureStructure[] {
  if (!props) {
    return []
  }

  return Object.keys(props).map(name => {
    let prop = props[name]
    return {
      name,
      type: type(proj, api, prop, imports),
      hasQuestionToken: !(required || []).includes(name),
      docs: prop.description ? [prop.description] : [],
    }
  })
}

export function type(proj: Project, api: API, value: Value, imports: Imports): string {
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
        t = `{[name: string]: ${type(proj, api, value.additionalProperties, imports)}}`
        break
      case 'array':
        t = `Array<${type(proj, api, value.items, imports)}>`
        break
      default:
        assertNever(value)
    }
  } else {
    assertNever(value)
  }

  return t
}

export function parseDefName(name: string): {name: string; path: string} | undefined {
  const match = /^io\.k8s\.(?:(apimachinery)\.pkg(?:\.apis)?|api)/.exec(name)
  if (match == null) {
    return undefined
  }
  name = name.slice(match[0].length)

  if (match[1]) {
    name = `${match[1]}.${name}`
  }

  let parts = name.split('.')
  name = parts[parts.length - 1]
  let path = parts.slice(0, -1).join('/')

  return {name, path}
}

const elidedTypes: {[name: string]: string} = {
  IntOrString: 'number | string',
}
const scalarTypes: {[name: string]: string} = {
  Time: 'string',
  MicroTime: 'string',
}

const filePath = (path: string): string => `src/${path}.ts`

const assertNever = (_: never) => {
  throw new Error('"unreachable" code was reached')
}
