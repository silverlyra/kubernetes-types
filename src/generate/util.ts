import Project, {SourceFile} from 'ts-simple-ast'

export class Imports {
  private imports: Map<SourceFile, Set<string>> = new Map()

  constructor(private file: SourceFile) {}

  public add(from: SourceFile, name: string): this {
    if (from === this.file) {
      return this
    }

    let fileImports = this.imports.get(from)
    if (fileImports == null) {
      fileImports = new Set()
      this.imports.set(from, fileImports)
    }

    fileImports.add(name)
    return this
  }

  public apply() {
    for (let [from, names] of this.imports) {
      let relativePath = this.file.getDirectory().getRelativePathAsModuleSpecifierTo(from)
      this.file.addImportDeclaration({
        moduleSpecifier: relativePath,
        namedImports: [...names].sort(),
      })
    }
  }
}

export const ensureFile = (proj: Project, path: string): SourceFile => {
  let sourceFile = proj.getSourceFile(path)
  if (sourceFile == null) {
    sourceFile = proj.createSourceFile(path)
  }
  return sourceFile
}
