/**
 * kubernetes-types-generator
 *
 * Generates TypeScript types for Kubernetes API resources.
 */

import {ArgumentParser} from 'argparse'
import {readFileSync, writeFileSync} from 'fs'
import {sync as mkdirpSync} from 'mkdirp'
import fetch from 'node-fetch'
import * as path from 'path'
import {Project, ScriptTarget} from 'ts-morph'
import {fileURLToPath} from 'url'

import {API} from '../openapi/index.js'
import generate from '../openapi/generate.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const assetsPath = path.normalize(path.join(__dirname, '..', '..', 'assets'))

interface Arguments {
  api: string
  file: string | undefined
  patch: number
  beta: number | undefined
}

async function main({api: apiVersion, file, patch, beta}: Arguments) {
  apiVersion = normalizeVersion(apiVersion)

  let api: API = file ? JSON.parse(readFileSync(file, 'utf8')) : await fetchAPI(apiVersion)

  let proj = new Project({
    compilerOptions: {target: ScriptTarget.ES2016},
    useInMemoryFileSystem: true,
  })

  generate(proj, api)
  let result = proj.emitToMemory({emitOnlyDtsFiles: true})
  let files = result.getFiles()

  const version = releaseVersion(apiVersion, {patch, beta})
  const destPath = path.normalize(path.join(__dirname, '..', '..', 'types', `v${version}`))
  for (let {filePath, text} of files) {
    let destFilePath = path.join(destPath, filePath.replace(/^\//, ''))
    mkdirpSync(path.dirname(destFilePath))
    writeFileSync(destFilePath, text, 'utf8')
    console.log(`v${version}${filePath}`)
  }

  let generatedPackage = JSON.parse(readFileSync(path.join(assetsPath, 'package.json'), 'utf8'))
  generatedPackage.version = version
  writeFileSync(
    path.join(destPath, 'package.json'),
    JSON.stringify(generatedPackage, null, 2),
    'utf8'
  )

  writeFileSync(
    path.join(destPath, 'README.md'),
    readFileSync(path.join(assetsPath, 'README.md'), 'utf8'),
    'utf8'
  )
}

function normalizeVersion(version: string): string {
  if (/^\d/.test(version)) {
    version = `v${version}`
  }
  if (/^v\d+\.\d+$/.test(version)) {
    version = `${version}.0`
  }

  return version
}

async function fetchAPI(version: string): Promise<API> {
  let response = await fetch(
    `https://raw.githubusercontent.com/kubernetes/kubernetes/${version}/api/openapi-spec/swagger.json`
  )

  let api = await response.json()
  return api as API
}

function releaseVersion(
  apiVersion: string,
  {patch, beta}: Pick<Arguments, 'patch' | 'beta'>
): string {
  let [major, minor] = apiVersion.replace(/^v/, '').split('.')
  let version = `${major}.${minor}.${patch}`
  if (beta) {
    version += `-beta.${beta}`
  }
  return version
}

const parser = new ArgumentParser({
  description: 'Generate TypeScript types for the Kubernetes API',
})
parser.addArgument(['-a', '--api'], {help: 'Kubernetes API version', defaultValue: 'master'})
parser.addArgument(['-f', '--file'], {help: 'Path to local swagger.json file'})
parser.addArgument(['-p', '--patch'], {
  help: 'Patch version of generated types',
  type: Number,
  defaultValue: 0,
})
parser.addArgument('--beta', {help: 'Create a beta release', type: Number})

main(parser.parseArgs()).catch(err => {
  console.error(err.stack)
  process.exit(1)
})
