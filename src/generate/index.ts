/**
 * kubernetes-types-generator
 *
 * Generates TypeScript types for Kubernetes API resources.
 */

import {readFileSync, writeFileSync} from 'fs'
import {sync as mkdirpSync} from 'mkdirp'
import * as path from 'path'
import Project, {ScriptTarget} from 'ts-simple-ast'

import {API} from '../openapi'
import generate from '../openapi/generate'

const destPath = path.normalize(path.join(__dirname, '..', '..', 'types', 'v1.13'))

let api: API = JSON.parse(readFileSync(process.argv[2], 'utf8'))
let proj = new Project({compilerOptions: {target: ScriptTarget.ES2016}, useVirtualFileSystem: true})

generate(proj, api)

let result = proj.emitToMemory({emitOnlyDtsFiles: true})
let files = result.getFiles()
for (let {filePath, text} of files) {
  let destFilePath = path.join(destPath, filePath.replace(/^\//, ''))
  mkdirpSync(path.dirname(destFilePath))
  writeFileSync(destFilePath, text, 'utf8')
  console.log(filePath)
}
