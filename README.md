# kubernetes-types

This package provides TypeScript definitions for Kubernetes API types, generated from the Kubernetes OpenAPI definitions.

## Example

```typescript
import {Pod} from 'kubernetes-types/core/v1'
import {ObjectMeta} from 'kubernetes-types/meta/v1'

let metadata: ObjectMeta = {name: 'example', labels: {app: 'example'}}
let pod: Pod = {
  apiVersion: 'v1',
  kind: 'Pod', // 'v1' and 'Pod' are the only accepted values for a Pod

  metadata,

  spec: {
    containers: [
      /* ... */
    ],
  },
}
```

## Versioning

As an NPM package, kubernetes-types follows semver. The major and minor version of the package will track the Kubernetes API version, while the patch version will follow updates to the generated types.

You should install the version of the types matching the Kubernetes API version you want to be compatible with. Consult [NPM][versions] for the list of available versions of this package.

[versions]: https://www.npmjs.com/package/kubernetes-types?activeTab=versions

## This repository

This repository contains the code used to generate the TypeScript types, not the types themselves.
