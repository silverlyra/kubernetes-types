import {readFileSync} from 'fs'
import Project, {ScriptTarget} from 'ts-simple-ast'

import {API} from '../openapi'
import generate from '../openapi/generate'

let api: API = JSON.parse(readFileSync(process.argv[2], 'utf8'))
let proj = new Project({compilerOptions: {target: ScriptTarget.ES2016}, useVirtualFileSystem: true})

generate(proj, api)

let result = proj.emitToMemory({emitOnlyDtsFiles: true})
let files = result.getFiles()
for (let {filePath, text} of files) {
  console.log(`// ${filePath}`)
  console.log(text)
  console.log()
}
