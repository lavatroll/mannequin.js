import { cp } from 'fs/promises'
import replace from 'replace-in-file'

await cp('./node_modules/three/build/three.module.js', './libs/three.mjs')
await cp('./node_modules/three/examples/jsm/loaders/FontLoader.js', './libs/FontLoader.mjs')
await cp('./node_modules/three/examples/jsm/exporters/GLTFExporter.js', './libs/GLTFExporter.mjs')
await cp('./node_modules/three/examples/jsm/controls/OrbitControls.js', './libs/OrbitControls.mjs')
await cp('./node_modules/three/examples/jsm/geometries/TextGeometry.js', './libs/TextGeometry.mjs')
await cp('./node_modules/three/examples/jsm/utils/TextureUtils.js', './libs/TextureUtils.mjs')

await replace({ files: 'libs/*.mjs', from: 'from \'three\'', to: 'from \'./three.mjs\'' })
await replace({ files: 'libs/*.mjs', from: 'from \'./../utils/TextureUtils.js', to: 'from \'./TextureUtils.mjs' })
