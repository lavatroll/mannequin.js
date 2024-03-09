import {
  BufferGeometry,
  Clock,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PerspectiveCamera,
  Scene,
  TextureLoader,
  Vector3,
  WebGLRenderer
} from './libs/three.mjs'
import { GLTFExporter } from './libs/GLTFExporter.mjs'

// mannequin.js
//
// a library for human figure
//
// joint constraints reference:
//    https://www.dshs.wa.gov/sites/default/files/forms/pdf/13-585a.pdf

/*
  Change log

  4.04  added Joint.select(...)
  4.1   converted from methods to virtual properties
  4.2   support for truly local rotations in any order and interlacing
  4.3   absolute and relative rotations + significant refactoring
  4.4   added AR mode -- and then removed
  4.41  beautified by www.freeformatter.com
  4.5   added individual fingers
  5.0   updated to ES6 modules & npm usage
*/

export const MANNEQUIN_VERSION = 5.0
export const MANNEQUIN_POSTURE_VERSION = 7

export const AXIS = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1)
}

export class MannequinPostureVersionError extends Error {
  constructor (version) {
    super('Posture data version ' + version + ' is incompatible with the currently supported version ' + MANNEQUIN_POSTURE_VERSION + '.')
    this.name = 'IncompatibleMannequinError'
  }
}

// helper functions working with degrees
export function rad (x) {
  return x * Math.PI / 180
}

export function grad (x) {
  return Number((x * 180 / Math.PI).toFixed(1))
}

export function sin (x) {
  return Math.sin(rad(x))
}

export function cos (x) {
  return Math.cos(rad(x))
}

/**
 * Parametric Surfaces Geometry
 * based on the brilliant article by @prideout https://prideout.net/blog/old/blog/index.html@p=44.html
 */
export class ParametricGeometry extends BufferGeometry {
  constructor (func = (u, v, target) => target.set(u, v, Math.cos(u) * Math.sin(v)), slices = 8, stacks = 8) {
    super()
    this.type = 'ParametricGeometry'
    this.parameters = {
      func,
      slices,
      stacks
    }

    // buffers

    const indices = []
    const vertices = []
    const normals = []
    const uvs = []
    const EPS = 0.00001
    const normal = new Vector3()
    const p0 = new Vector3()
    const p1 = new Vector3()
    const pu = new Vector3()
    const pv = new Vector3()

    // generate vertices, normals and uvs

    const sliceCount = slices + 1
    for (let i = 0; i <= stacks; i++) {
      const v = i / stacks
      for (let j = 0; j <= slices; j++) {
        const u = j / slices

        // vertex

        func(u, v, p0)
        vertices.push(p0.x, p0.y, p0.z)

        // normal

        // approximate tangent vectors via finite differences

        if (u - EPS >= 0) {
          func(u - EPS, v, p1)
          pu.subVectors(p0, p1)
        } else {
          func(u + EPS, v, p1)
          pu.subVectors(p1, p0)
        }

        if (v - EPS >= 0) {
          func(u, v - EPS, p1)
          pv.subVectors(p0, p1)
        } else {
          func(u, v + EPS, p1)
          pv.subVectors(p1, p0)
        }

        // cross product of tangent vectors returns surface normal

        normal.crossVectors(pu, pv).normalize()
        normals.push(normal.x, normal.y, normal.z)

        // uv

        uvs.push(u, v)
      }
    }

    // generate indices

    for (let i = 0; i < stacks; i++) {
      for (let j = 0; j < slices; j++) {
        const a = i * sliceCount + j
        const b = i * sliceCount + j + 1
        const c = (i + 1) * sliceCount + j + 1
        const d = (i + 1) * sliceCount + j

        // faces one and two

        indices.push(a, b, d)
        indices.push(b, c, d)
      }
    }

    // build geometry

    this.setIndex(indices)
    this.setAttribute('position', new Float32BufferAttribute(vertices, 3))
    this.setAttribute('normal', new Float32BufferAttribute(normals, 3))
    this.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  }
}

// create parametric surface
export class ParametricShape extends Group {
  constructor (tex, col, func, nU = 3, nV = 3) {
    super()
    const obj = new Mesh(
      new ParametricGeometry(func, nU, nV),
      new MeshStandardMaterial(
        {
          color: col,
          // shininess: 1,
          map: tex
        })
    )
    obj.receiveShadow = true
    obj.castShadow = true
    this.add(obj)
  } // ParametricShape.constructor

  addSphere (r, y, x = 0, z = 0) {
    const s = new Mesh(Mannequin.sphereGeometry,
      new MeshLambertMaterial(
        {
          color: Mannequin.colors[3]
        }))
    s.castShadow = true
    s.receiveShadow = true
    s.scale.set(r, r, r)
    s.position.set(x, y, z)
    this.add(s)
    return s
  } // ParametricShape.addSphere
} // ParametricShape

// head shape as parametric surface
export class HeadShape extends ParametricShape {
  constructor (feminine, params) {
    super(Mannequin.texHead, Mannequin.colors[0], function (u, v, target) {
      const r = Mannequin.cossers(u, v, [
        [0.4, 0.9, 0, 1, -3],
        [0, 1, 0, 0.1, 3],
        [0, 1, 0.9, 1, 3],
        [1.00, 1.05, 0.55, 0.85, -3],
        [1.00, 1.05, 0.15, 0.45, -3],
        [0.93, 1.08, 0.40, 0.60, 8],
        [0.0, 0.7, 0.05, 0.95, 3],
        [-0.2, 0.2, -0.15, 1.15, -6],
        [-0.07, 0.07, 0.45, 0.55, 20], // nose
        [-0.07, 0.01, 0.35, 0.55, 10], // nostril
        [-0.07, 0.01, 0.45, 0.65, 10] // nostril
      ])
      u = 360 * u
      v = 180 * v - 90
      const k = (1 + (feminine ? 1 : 2) * sin(u) * cos(v)) / 4
      target.set(
        r * params.sx * cos(u) * cos(v),
        r * params.sy * sin(u) * cos(v),
        (r + k) * params.sz * sin(v))
    }, 32, 32)
  } // HeadShape.constructor
} // HeadShape

// shoe shape as parametric surface
export class ShoeShape extends Group {
  constructor (feminine, params) {
    super()

    this.add(new ParametricShape(Mannequin.texLimb, Mannequin.colors[1], function (u, v, target) {
      const r = Mannequin.cossers(u, v, [
        [0.6, 1.1, 0.05, 0.95, 1],
        [0.6, 0.68, 0.35, 0.65, feminine ? 1.2 : 1000]
      ])
      u = 360 * u
      v = 180 * v - 90
      target.set(
        (3 * r - 2) * params.sx * (cos(u) * cos(v) + (feminine ? (Math.pow(sin(u + 180), 2) * cos(v) - 1) : 0)) - (feminine ? 0 : 2),
        params.sy * sin(u) * cos(v) + 2,
        params.sz * sin(v))
    }, 24, 12))

    if (feminine) {
      this.add(new ParametricShape(Mannequin.texLimb, Mannequin.colors[4], function (u, v, target) {
        const r = Mannequin.cossers(u, v, [
          [0.6, 1.1, 0.05, 0.95, 1 / 2]
        ])
        u = 360 * u
        v = 180 * v - 90
        target.set(
          0.3 * (3 * r - 2) * params.sx * (cos(u) * cos(v)),
          0.8 * params.sy * sin(u) * cos(v) + 2,
          0.6 * params.sz * sin(v))
      }, 12, 12))

      this.children[0].rotation.set(0, 0, 0.4)
      this.children[1].rotation.set(0, 0, 0.4)
    } // if (feminine)

    this.rotation.z = -Math.PI / 2
  } // ShoeShape.constructor
} // ShoeShape

// pelvis shape as parametric surface
export class PelvisShape extends ParametricShape {
  constructor (feminine, params) {
    super(Mannequin.texLimb, Mannequin.colors[2], function (u, v, target) {
      const r = Mannequin.cossers(u, v, [
        [0.6, 0.95, 0, 1, 4],
        [0.7, 1.0, 0.475, 0.525, -13],
        [-0.2, 0.3, 0, 0.3, -4],
        [-0.2, 0.3, -0.3, 0, -4]
      ])
      u = 360 * u - 90
      v = 180 * v - 90
      target.set(-1.5 + r * params[0] * cos(u) * Math.pow(cos(v), 0.6),
        r * params[1] * sin(u) * Math.pow(cos(v), 0.6),
        r * params[2] * sin(v))
    }, 20, 10)
  } // PelvisShape.constructor
} // PelvisShape

// limb shape as parametric surface
export class LimbShape extends ParametricShape {
  constructor (feminine, params, nU = 24, nV = 12) {
    const x = params[0]
    const y = params[1]
    const z = params[2]
    const alpha = params[3]
    const dAlpha = params[4]
    const offset = params[5]
    const scale = params[6]
    const rad = params[7]
    super(Mannequin.texLimb, Mannequin.colors[4], function (u, v, target) {
      v = 360 * v
      const r = offset + scale * cos(alpha + dAlpha * u)
      target.set(x * r * cos(v) / 2, y * u, z * r * sin(v) / 2)
      const w = new Vector3(x * cos(v) * cos(170 * u - 85) / 2,
        y * (1 / 2 + sin(180 * u - 90) / 2),
        z * sin(v) * cos(180 * u - 90) / 2)
      target = target.lerp(w, Math.pow(Math.abs(2 * u - 1), 16))
    }, nU, nV)
    this.children[0].position.set(0, -y / 2, 0)

    if (rad) this.addSphere(rad || z / 2, -y / 2)
  } // LimbShape.constructor
} // LimbShape

// torso shape as parametric surface
export class TorsoShape extends ParametricShape {
  constructor (feminine, params) {
    const x = params[0]
    const y = params[1]
    const z = params[2]
    const alpha = params[3]
    const dAlpha = params[4]
    const offset = params[5]
    const scale = params[6]
    super(Mannequin.texLimb, Mannequin.colors[5], function (u, v, target) {
      let r = offset + scale * cos(alpha + dAlpha * u)
      if (feminine) {
        r += Mannequin.cossers(u, v, [
          [0.35, 0.85, 0.7, 0.95, 2],
          [0.35, 0.85, 0.55, 0.8, 2]
        ]) - 1
      }
      v = 360 * v + 90
      const x1 = x * (0.3 + r) * cos(v) / 2
      const y1 = y * u
      const z1 = z * r * sin(v) / 2
      const x2 = x * cos(v) * cos(180 * u - 90) / 2
      const y2 = y * (1 / 2 + sin(180 * u - 90) / 2)
      const z2 = z * sin(v) * cos(180 * u - 90) / 2
      const k = Math.pow(Math.abs(2 * u - 1), 16)
      let kx = Math.pow(Math.abs(2 * u - 1), 2)
      if (x2 < 0) kx = k
      target.set(x1 * (1 - kx) + kx * x2, y1 * (1 - k) + k * y2, z1 * (1 - k) + k * z2)
    }, 30, 20)

    this.children[0].position.set(0, -y / 2, 0)

    this.addSphere(2, -y / 2)
  } // TorsoShape.constructor
} // TorsoShape

// flexible joint
export class Joint extends Group {
  /* eslint-disable new-cap */
  constructor (parentJoint, pos, params, shape) {
    super()
    const yVal = params.sy || params[1]

    if (shape) { this.image = new shape(parentJoint ? parentJoint.feminine : false, params) } else { this.image = new Group() }

    this.image.castShadow = true
    if (shape !== PelvisShape && shape !== ShoeShape) this.image.position.set(0, yVal / 2, 0)

    this.imageWrapper = new Group()
    this.imageWrapper.add(this.image)
    this.imageWrapper.castShadow = true

    this.add(this.imageWrapper)

    this.castShadow = true
    this.yVal = yVal
    this.parentJoint = parentJoint

    if (parentJoint) { // attaching to parent joint
      this.position.set(0, shape ? parentJoint.yVal : parentJoint.yVal / 4, 0)
      parentJoint.imageWrapper.add(this)
      this.feminine = parentJoint.feminine
    }

    if (pos) { // initial joint position
      this.position.set(pos[0], pos[1], pos[2])
    }

    this.minRot = new Vector3()
    this.maxRot = new Vector3()
  } // Joint.constructor

  get z () {
    return this.rotation.z * 180 / Math.PI
  }

  set z (angle) {
    this.rotation.z = angle * Math.PI / 180
  } // Joint.z

  get x () {
    return this.rotation.x * 180 / Math.PI
  }

  set x (angle) {
    this.rotation.x = angle * Math.PI / 180
  } // Joint.x

  get y () {
    return this.rotation.y * 180 / Math.PI
  }

  set y (angle) {
    this.rotation.y = angle * Math.PI / 180
  } // Joint.y

  reset () {
    this.rotation.set(0, 0, 0)
  }

  get posture () {
    return [grad(this.rotation.x), grad(this.rotation.y), grad(this.rotation.z)]
  }

  set posture (pos) {
    this.rotation.set(rad(pos[0]), rad(pos[1]), rad(pos[2]))
  } // Joint.posture

  getBumper (x, y, z) {
    const bumper = new Vector3(x, y, z)
    this.image.localToWorld(bumper)
    this.parentJoint.image.worldToLocal(bumper)
    return bumper
  }

  hide () {
    this.image.visible = false
  } // Joint.hide

  show () {
    this.image.visible = true
  } // Joint.show

  // attach Object3D instance to the joint
  attach (image) {
    this.imageWrapper.add(image)
  } // Joint.attach

  detach (image) {
    if (this.imageWrapper.children.includes(
      this.imageWrapper.getObjectById(image.id))) {
      this.imageWrapper.remove(
        this.imageWrapper.getObjectById(image.id)
      )
    }
  } // Joint.detach

  // calculate global coordinates of point with coordinates relative to the joint
  point (scene, x, y, z) {
    return scene.worldToLocal(this.localToWorld(new Vector3(x, y, z)))
  } // Joint.point

  // change the colour of the joint
  recolor (color, secondaryColor = color) {
    const joint = this.image

    if (typeof color === 'string') { color = new Color(color) }

    if (typeof secondaryColor === 'string') { secondaryColor = new Color(secondaryColor) }

    joint.children[0].material.color = color

    if (joint.children.length > 1) {
      joint.children[1].material.color = secondaryColor
    }
  } // Joint.recolor

  select (state) {
    this.traverse(function (o) {
      if (o.material && o.material.emissive) o.material.emissive.setRGB(0, state ? -1 : 0, state ? -0.4 : 0)
    })
  } // Joint.select
} // Joint

export class Pelvis extends Joint {
  constructor (parentJoint) {
    super(parentJoint, null, [3, 4, parentJoint.feminine ? 5.5 : 5], PelvisShape)

    this.minRot = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY)
    this.maxRot = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)
  } // Pelvis.constructor
} // Pelvis

export class Body extends Joint {
  constructor (feminine) {
    super(null, null, [1, 1, 1], Group)

    this.feminine = feminine

    this.minRot = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY)
    this.maxRot = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)
  } // Body.constructor

  get bend () {
    return -this.z
  }

  set bend (angle) {
    this.z = -angle
  }

  get tilt () {
    return -this.x
  }

  set tilt (angle) {
    this.x = -angle
  }

  get turn () {
    return this.y
  }

  set turn (angle) {
    this.y = angle
  }
} // Body

export class Torso extends Joint {
  constructor (parentJoint) {
    super(parentJoint, [-2, 4, 0], [5, 17, 10, parentJoint.feminine ? 10 : 80, parentJoint.feminine ? 520 : 380, parentJoint.feminine ? 0.8 : 0.9, parentJoint.feminine ? 0.25 : 0.2], TorsoShape)

    this.minRot = new Vector3(-25, -50, -60)
    this.maxRot = new Vector3(25, 50, 25)
  } // Torso.constructor

  get bend () {
    return -this.z
  }

  set bend (angle) {
    this.z = -angle
  }

  get tilt () {
    return -this.x
  }

  set tilt (angle) {
    this.x = -angle
  }

  get turn () {
    return this.y
  }

  set turn (angle) {
    this.y = angle
  }
} // Torso

export class Neck extends Joint {
  constructor (parentJoint) {
    super(parentJoint, [0, 15, 0], [2, parentJoint.feminine ? 5 : 4, 2, 45, 60, 1, 0.2, 0], LimbShape)

    this.minRot = new Vector3(-45 / 2, -90 / 2, -60)
    this.maxRot = new Vector3(45 / 2, 90 / 2, 50 / 2)
  } // Neck.constructor
} // Neck

export class Head extends Joint {
  static SIZE = { sx: 3, sy: 4, sz: 2.5 }

  constructor (parentJoint) {
    super(parentJoint, [1, 3, 0], Head.SIZE, HeadShape)

    this.minRot = new Vector3(-45 / 2, -90 / 2, -60 / 2)
    this.maxRot = new Vector3(45 / 2, 90 / 2, 50 / 2)
  } // Head.constructor

  get nod () {
    return -2 * this.z
  }

  set nod (angle) {
    this.z = -angle / 2
    this.parentJoint.z = -angle / 2
  }

  get tilt () {
    return -2 * this.x
  }

  set tilt (angle) {
    this.x = -angle / 2
    this.parentJoint.x = -angle / 2
  }

  get turn () {
    return 2 * this.y
  }

  set turn (angle) {
    this.y = angle / 2
    this.parentJoint.y = angle / 2
  }

  get posture () {
    return [grad(this.rotation.x), grad(this.rotation.y), grad(this.rotation.z)]
  }

  set posture (pos) {
    this.rotation.set(rad(pos[0]), rad(pos[1]), rad(pos[2]))
    this.parentJoint.rotation.set(rad(pos[0]), rad(pos[1]), rad(pos[2]))
  } // Head.posture
} // Head

export class Leg extends Joint {
  constructor (parentJoint, leftOrRight) {
    super(parentJoint, [-1, -3, 4 * leftOrRight], [4, 15, 4, -70, 220, 1, 0.4, 2], LimbShape)
    this.leftOrRight = leftOrRight

    this.imageWrapper.rotation.set(Math.PI, 0, 0)

    //    this.image.addSphere(0.4, 0,5,0);
  } // Leg.constructor

  biologicallyImpossibleLevel () {
    // return 0 if the rotation is possible
    // return >0 if it is not possible, the higher the result, the more impossible it is

    let result = 0

    this.image.updateWorldMatrix(true)

    const p = this.getBumper(5, 0, 0)
    if (p.x < 0) result += -p.x

    const y = this.y
    if (y > +60) result += y - 60
    if (y < -60) result += -60 - y

    return result
  } // Leg.biologicallyImpossibleLevel

  get raise () {
    return this.z
  }

  set raise (angle) {
    this.z = angle
  }

  get straddle () {
    return -this.leftOrRight * this.x
  }

  set straddle (angle) {
    this.x = -this.leftOrRight * angle
  }

  get turn () {
    return -this.leftOrRight * this.y
  }

  set turn (angle) {
    this.y = -this.leftOrRight * angle
  }
} // Leg

export class Knee extends Joint {
  constructor (parentJoint) {
    super(parentJoint, null, [4, 14, 4, -40, 290, 0.65, 0.25, 1.5], LimbShape)

    this.minRot = new Vector3(0, 0, 0)
    this.maxRot = new Vector3(0, 0, 150)
  } // Knee.constructor

  get bend () {
    return this.z
  }

  set bend (angle) {
    this.z = angle
  }

  get posture () {
    return [grad(this.rotation.z)]
  }

  set posture (pos) {
    this.rotation.set(0, 0, rad(pos[0]))
  }
} // Knee

export class Ankle extends Joint {
  static SIZE = { sx: 1, sy: 4, sz: 2 }

  constructor (parentJoint) {
    super(parentJoint, null, Ankle.SIZE, ShoeShape)
    this.leftOrRight = parentJoint.parentJoint.leftOrRight // i.e. leg

    this.minRot = new Vector3(-25, -30, -70)
    this.maxRot = new Vector3(25, 30, 80)
  } // Ankle.constructor

  get bend () {
    return -this.z
  }

  set bend (angle) {
    this.z = -angle
  }

  get tilt () {
    return this.leftOrRight * this.x
  }

  set tilt (angle) {
    this.x = this.leftOrRight * angle
  }

  get turn () {
    return this.leftOrRight * this.y
  }

  set turn (angle) {
    this.y = this.leftOrRight * angle
  }
} // Ankle

export class Arm extends Joint {
  constructor (parentJoint, leftOrRight) {
    super(parentJoint, [0, 14, leftOrRight * (parentJoint.feminine ? 5 : 6)], [3.5, 11, 2.5, -90, 360, 0.9, 0.2, 1.5], LimbShape)
    this.leftOrRight = leftOrRight

    this.imageWrapper.rotation.set(Math.PI, Math.PI, 0)

    // this.image.addSphere(2,15,0,0);
  } // Arm.constructor

  biologicallyImpossibleLevel () {
    let result = 0

    this.image.updateWorldMatrix(true)

    const p = this.getBumper(0, 15, -0 * 5 * this.leftOrRight)

    if (p.z * this.leftOrRight < -3) result += -3 - p.z * this.leftOrRight

    if (p.x < -7 && p.y > 0) result = p.y

    const r = this.rotation.y * 180 / Math.PI
    const min = -90
    const max = 90
    // document.getElementById("name").innerHTML = (this.rotation.x*180/Math.PI).toFixed(0)+' '+(this.rotation.y*180/Math.PI).toFixed(0)+' '+(this.rotation.z*180/Math.PI).toFixed(0);
    // document.getElementById("name").innerHTML += '<br>'+(p.x).toFixed(1)+' '+(p.y).toFixed(1)+' '+(p.z).toFixed(1);

    if (r > max) result += r - max
    if (r < min) result += min - r
    return result
  }

  get raise () {
    return this.z
  }

  set raise (angle) {
    this.z = angle
  }

  get straddle () {
    return -this.leftOrRight * this.x
  }

  set straddle (angle) {
    this.x = -this.leftOrRight * angle
  }

  get turn () {
    return -this.leftOrRight * this.y
  }

  set turn (angle) {
    this.y = -this.leftOrRight * angle
  }
} // Arm

export class Elbow extends Joint {
  constructor (parentJoint) {
    super(parentJoint, null, [2.5, 11, 2, -40, 150, 0.5, 0.45, 1.1], LimbShape)

    this.minRot = new Vector3(0, 0, 0)
    this.maxRot = new Vector3(0, 0, 150)
  } // Elbow.constructor

  get bend () {
    return this.z
  }

  set bend (angle) {
    this.z = angle
  }

  get posture () {
    return [grad(this.rotation.z)]
  }

  set posture (pos) {
    this.rotation.set(0, 0, rad(pos[0]))
  }
} // Elbow

export class Wrist extends Joint {
  constructor (parentJoint) {
    super(parentJoint, null, [1, 2.2, 2.5, -90, 120, 0.5, 0.3, 1 / 2], LimbShape)
    this.leftOrRight = parentJoint.parentJoint.leftOrRight

    this.imageWrapper.rotation.set(0, -this.leftOrRight * Math.PI / 2, 0)

    if (this.leftOrRight === -1) {
      this.minRot = new Vector3(-20, -90, -90)
      this.maxRot = new Vector3(35, 90, 90)
    } else {
      this.minRot = new Vector3(-35, -90, -90)
      this.maxRot = new Vector3(20, 90, 90)
    }

    // this.image.addSphere( 1, 0,5,0 );
  } // Wrist.constructor

  biologicallyImpossibleLevel () {
    // return 0 if the rotation is possible
    // return >0 if it is not possible, the higher the result, the more impossible it is

    let result = 0

    const wristX = new Vector3()
    const wristY = new Vector3()
    const wristZ = new Vector3()
    this.matrixWorld.extractBasis(wristX, wristY, wristZ)

    const elbowX = new Vector3()
    const elbowY = new Vector3()
    const elbowZ = new Vector3()
    this.parentJoint.matrixWorld.extractBasis(elbowX, elbowY, elbowZ)

    const dot1 = wristY.dot(elbowY)
    if (dot1 < 0) result += -dot1

    const dot2 = wristZ.dot(elbowZ)
    if (dot2 < 0) result += -dot2

    return result
  } // Wrist.biologicallyImpossibleLevel

  get bend () {
    return -this.leftOrRight * this.x
  }

  set bend (angle) {
    this.x = -this.leftOrRight * angle
  }

  get tilt () {
    return this.leftOrRight * this.z
  }

  set tilt (angle) {
    this.z = this.leftOrRight * angle
  }

  get turn () {
    return this.leftOrRight * this.y
  }

  set turn (angle) {
    this.y = this.leftOrRight * angle
  }
} // Wrist

export class Phalange extends Joint {
  constructor (parentJoint, params, nailSize) {
    super(parentJoint, null, params, LimbShape)

    this.minRot = new Vector3(0, 0, -10)
    this.maxRot = new Vector3(0, 0, 100)

    if (nailSize > 0) {
      this.nail = new Mesh(Mannequin.sphereGeometry,
        new MeshLambertMaterial(
          {
            color: Mannequin.colors[6]
          }))
      this.nail.castShadow = true
      this.nail.receiveShadow = true
      this.nail.scale.set(0.05, 0.2 * nailSize, 0.1 * nailSize)
      this.nail.position.set(params[0] / 4, params[1] * 0.7, 0)
      this.nail.rotation.set(0, 0, 0.2)
      this.nail.recolor = function (color) {
        if (typeof color === 'string') { color = new Color(color) }

        this.parent.nail.material.color = color
      }

      this.add(this.nail)
    }
  } // Phalange.constructor

  get bend () {
    return this.z
  }

  set bend (angle) {
    this.z = angle
  }
} // Phalange

// size-x, size-y, size-z, alpha, dAlpha, offset, scale, rad
export class Finger extends Phalange {
  constructor (parentJoint, leftOrRight, number) {
    const thumb = (number === 0)

    const sca = [1.1, 0.95, 1, 0.95, 0.8][number]
    const fat = [1.0, 0.95, 1, 0.95, 0.8][number]
    const fat2 = [1.5, 1, 1, 1, 1][number]

    //   const minX = [ 0, -25, -10, -15, -35][number] * leftOrRight;
    //   const maxX = [60,  25,  10,   5,  10][number] * leftOrRight;

    const minX = [0, -20, -15, -25, -35][number] * leftOrRight
    const maxX = [50, 35, 15, 15, 20][number] * leftOrRight

    super(parentJoint, [0.8 * fat, 0.8 * sca * (thumb ? 1.4 : 1), 0.8 * fat2, 0, 45, 0.3, 0.4, 0.25], 0)

    this.position.x = [-0.3, 0.0, 0.15, 0.15, 0.03][number]
    this.position.y = [0.5, 2.2, 2.3, 2.2, 2.1][number]
    this.position.z = [0.8, 0.7, 0.225, -0.25, -0.7][number] * leftOrRight

    this.mid = new Phalange(this, [0.6 * fat, 0.7 * sca * (thumb ? 1.1 : 1), 0.6 * fat2, 0, 60, 0.3, 0.4, 0.15], 0)
    this.tip = new Phalange(this.mid, [0.5 * fat, 0.6 * sca * (thumb ? 1.1 : 1), 0.5 * fat2, 0, 60, 0.3, 0.4, 0.1], fat2)

    this.leftOrRight = leftOrRight

    this.y = thumb ? -this.leftOrRight * 90 : 0

    this.minRot = new Vector3(Math.min(minX, maxX), Math.min(this.y, 2 * this.y), thumb ? -90 : -10)
    this.maxRot = new Vector3(Math.max(minX, maxX), Math.max(this.y, 2 * this.y), thumb ? 45 : 120)

    this.mid.minRot = new Vector3(0, 0, 0)
    this.mid.maxRot = new Vector3(0, 0, thumb ? 90 : 120)

    this.tip.minRot = new Vector3(0, 0, 0)
    this.tip.maxRot = new Vector3(0, 0, thumb ? 90 : 120)
  } // Finger.constructor

  get bend () {
    return this.z
  }

  set bend (angle) {
    this.z = angle
  }

  get straddle () {
    return -this.leftOrRight * this.x
  }

  set straddle (angle) {
    this.x = -this.leftOrRight * angle
  }

  get turn () {
    return -this.leftOrRight * this.y
  }

  set turn (angle) {
    this.y = -this.leftOrRight * angle
  }

  get posture () {
    return [
      grad(this.rotation.x),
      grad(this.rotation.y),
      grad(this.rotation.z),

      grad(this.mid.rotation.x),
      grad(this.mid.rotation.z),

      grad(this.tip.rotation.x),
      grad(this.tip.rotation.z)
    ]
  }

  set posture (pos) {
    this.rotation.x = rad(pos[0])
    this.rotation.y = rad(pos[1])
    this.rotation.z = rad(pos[2])
    this.mid.rotation.set(rad(pos[3]), 0, rad(pos[4]))
    this.tip.rotation.set(rad(pos[5]), 0, rad(pos[6]))
  }
} // Finger

export class Fingers extends Joint {
  // pseudo-object to allow mass control on fingers
  constructor (finger0, finger1, finger2, finger3, finger4) {
    super(null, null, {}, null)

    this.finger0 = finger0
    this.finger1 = finger1
    this.finger2 = finger2
    this.finger3 = finger3
    this.finger4 = finger4

    this.imageWrapper = this.finger2.imageWrapper
  }

  get bend () {
    return this.finger1.bend
  }

  set bend (angle) {
    this.finger0.bend = angle / 2
    this.finger1.bend = angle
    this.finger2.bend = angle
    this.finger3.bend = angle
    this.finger4.bend = angle

    this.finger0.mid.bend = angle / 2
    this.finger1.mid.bend = angle
    this.finger2.mid.bend = angle
    this.finger3.mid.bend = angle
    this.finger4.mid.bend = angle

    this.finger0.tip.bend = angle / 2
    this.finger1.tip.bend = angle
    this.finger2.tip.bend = angle
    this.finger3.tip.bend = angle
    this.finger4.tip.bend = angle
  }

  // change the colour of the joint
  recolor (color, secondaryColor = color) {
    this.finger0.recolor(color, secondaryColor)
    this.finger1.recolor(color, secondaryColor)
    this.finger2.recolor(color, secondaryColor)
    this.finger3.recolor(color, secondaryColor)
    this.finger4.recolor(color, secondaryColor)

    this.finger0.mid.recolor(color, secondaryColor)
    this.finger1.mid.recolor(color, secondaryColor)
    this.finger2.mid.recolor(color, secondaryColor)
    this.finger3.mid.recolor(color, secondaryColor)
    this.finger4.mid.recolor(color, secondaryColor)

    this.finger0.tip.recolor(color, secondaryColor)
    this.finger1.tip.recolor(color, secondaryColor)
    this.finger2.tip.recolor(color, secondaryColor)
    this.finger3.tip.recolor(color, secondaryColor)
    this.finger4.tip.recolor(color, secondaryColor)
  }
} // Fingers

export class Nails extends Joint {
  // pseudo-object to allow mass recolor of nails
  constructor (finger0, finger1, finger2, finger3, finger4) {
    super(null, null, {}, null)

    this.nail_0 = finger0.tip.nail
    this.nail_1 = finger1.tip.nail
    this.nail_2 = finger2.tip.nail
    this.nail_3 = finger3.tip.nail
    this.nail_4 = finger4.tip.nail
  }

  // change the colour of the nail
  recolor (color) {
    this.nail_0.recolor(color)
    this.nail_1.recolor(color)
    this.nail_2.recolor(color)
    this.nail_3.recolor(color)
    this.nail_4.recolor(color)
  }
} // Nails

export class Mannequin extends Group {
  constructor (feminine, height = 1) {
    super()

    const LEFT = -1
    const RIGHT = 1

    this.scale.set(height, height, height)

    this.feminine = feminine

    this.body = new Body(feminine)

    this.pelvis = new Pelvis(this.body)
    this.torso = new Torso(this.pelvis)
    this.neck = new Neck(this.torso)
    this.head = new Head(this.neck)

    this.l_leg = new Leg(this.pelvis, LEFT)
    this.l_knee = new Knee(this.l_leg)
    this.l_ankle = new Ankle(this.l_knee)

    this.r_leg = new Leg(this.pelvis, RIGHT)
    this.r_knee = new Knee(this.r_leg)
    this.r_ankle = new Ankle(this.r_knee)

    this.l_arm = new Arm(this.torso, LEFT)
    this.l_elbow = new Elbow(this.l_arm)
    this.l_wrist = new Wrist(this.l_elbow)
    this.l_finger_0 = new Finger(this.l_wrist, LEFT, 0)
    this.l_finger_1 = new Finger(this.l_wrist, LEFT, 1)
    this.l_finger_2 = new Finger(this.l_wrist, LEFT, 2)
    this.l_finger_3 = new Finger(this.l_wrist, LEFT, 3)
    this.l_finger_4 = new Finger(this.l_wrist, LEFT, 4)

    this.l_fingers = new Fingers(this.l_finger_0, this.l_finger_1, this.l_finger_2, this.l_finger_3, this.l_finger_4)
    this.l_nails = new Nails(this.l_finger_0, this.l_finger_1, this.l_finger_2, this.l_finger_3, this.l_finger_4)

    this.r_arm = new Arm(this.torso, RIGHT)
    this.r_elbow = new Elbow(this.r_arm)
    this.r_wrist = new Wrist(this.r_elbow)
    this.r_finger_0 = new Finger(this.r_wrist, RIGHT, 0)
    this.r_finger_1 = new Finger(this.r_wrist, RIGHT, 1)
    this.r_finger_2 = new Finger(this.r_wrist, RIGHT, 2)
    this.r_finger_3 = new Finger(this.r_wrist, RIGHT, 3)
    this.r_finger_4 = new Finger(this.r_wrist, RIGHT, 4)

    this.r_fingers = new Fingers(this.r_finger_0, this.r_finger_1, this.r_finger_2, this.r_finger_3, this.r_finger_4)
    this.r_nails = new Nails(this.r_finger_0, this.r_finger_1, this.r_finger_2, this.r_finger_3, this.r_finger_4)

    this.add(this.body)

    const s = 1.5 / (0.5 + height)
    this.head.scale.set(s, s, s)
    this.castShadow = false
    this.receiveShadow = true

    this.updateMatrix()
    this.updateWorldMatrix()

    // default general posture
    this.body.turn = -90

    this.torso.bend = 2

    this.head.nod = -10

    this.l_arm.raise = -5
    this.r_arm.raise = -5

    this.l_arm.straddle = 7
    this.r_arm.straddle = 7

    this.l_elbow.bend = 15
    this.r_elbow.bend = 15

    this.l_wrist.bend = 5
    this.r_wrist.bend = 5

    this.l_finger_0.straddle = -20
    this.r_finger_0.straddle = -20

    this.l_finger_0.bend = -15
    this.l_finger_1.bend = 10
    this.l_finger_2.bend = 10
    this.l_finger_3.bend = 10
    this.l_finger_4.bend = 10

    this.l_finger_0.mid.bend = 10
    this.l_finger_1.mid.bend = 10
    this.l_finger_2.mid.bend = 10
    this.l_finger_3.mid.bend = 10
    this.l_finger_4.mid.bend = 10

    this.l_finger_0.tip.bend = 10
    this.l_finger_1.tip.bend = 10
    this.l_finger_2.tip.bend = 10
    this.l_finger_3.tip.bend = 10
    this.l_finger_4.tip.bend = 10

    this.r_finger_0.bend = -15
    this.r_finger_1.bend = 10
    this.r_finger_2.bend = 10
    this.r_finger_3.bend = 10
    this.r_finger_4.bend = 10

    this.r_finger_0.mid.bend = 10
    this.r_finger_1.mid.bend = 10
    this.r_finger_2.mid.bend = 10
    this.r_finger_3.mid.bend = 10
    this.r_finger_4.mid.bend = 10

    this.r_finger_0.tip.bend = 10
    this.r_finger_1.tip.bend = 10
    this.r_finger_2.tip.bend = 10
    this.r_finger_3.tip.bend = 10
    this.r_finger_4.tip.bend = 10
  } // Mannequin.constructor

  get bend () {
    return -this.body.z
  }

  set bend (angle) {
    this.body.z = -angle
  }

  get tilt () {
    return this.body.x
  }

  set tilt (angle) {
    this.body.x = angle
  }

  get turn () {
    return this.body.y
  }

  set turn (angle) {
    this.body.y = angle
  }

  get posture () {
    const posture = [
      [
        Number((this.body.position.x /* + this.position.x */).toFixed(1)),
        Number((this.body.position.y /* + this.position.y */).toFixed(1)),
        Number((this.body.position.z /* + this.position.z */).toFixed(1))
      ],
      this.body.posture,
      this.torso.posture,
      this.head.posture,
      this.l_leg.posture,
      this.l_knee.posture,
      this.l_ankle.posture,
      this.r_leg.posture,
      this.r_knee.posture,
      this.r_ankle.posture,
      this.l_arm.posture,
      this.l_elbow.posture,
      this.l_wrist.posture,
      this.l_finger_0.posture,
      this.l_finger_1.posture,
      this.l_finger_2.posture,
      this.l_finger_3.posture,
      this.l_finger_4.posture,
      this.r_arm.posture,
      this.r_elbow.posture,
      this.r_wrist.posture,
      this.r_finger_0.posture,
      this.r_finger_1.posture,
      this.r_finger_2.posture,
      this.r_finger_3.posture,
      this.r_finger_4.posture
    ]
    return {
      version: MANNEQUIN_POSTURE_VERSION,
      data: posture
    }
  } // Mannequin.posture

  set posture (posture) {
    if (posture.version !== MANNEQUIN_POSTURE_VERSION) { throw new MannequinPostureVersionError(posture.version) }

    let i = 0

    this.body.position.set(...posture.data[i++])

    this.body.posture = posture.data[i++]
    this.torso.posture = posture.data[i++]
    this.head.posture = posture.data[i++]

    this.l_leg.posture = posture.data[i++]
    this.l_knee.posture = posture.data[i++]
    this.l_ankle.posture = posture.data[i++]

    this.r_leg.posture = posture.data[i++]
    this.r_knee.posture = posture.data[i++]
    this.r_ankle.posture = posture.data[i++]

    this.l_arm.posture = posture.data[i++]
    this.l_elbow.posture = posture.data[i++]
    this.l_wrist.posture = posture.data[i++]
    this.l_finger_0.posture = posture.data[i++]
    this.l_finger_1.posture = posture.data[i++]
    this.l_finger_2.posture = posture.data[i++]
    this.l_finger_3.posture = posture.data[i++]
    this.l_finger_4.posture = posture.data[i++]

    this.r_arm.posture = posture.data[i++]
    this.r_elbow.posture = posture.data[i++]
    this.r_wrist.posture = posture.data[i++]
    this.r_finger_0.posture = posture.data[i++]
    this.r_finger_1.posture = posture.data[i++]
    this.r_finger_2.posture = posture.data[i++]
    this.r_finger_3.posture = posture.data[i++]
    this.r_finger_4.posture = posture.data[i++]
  } // Mannequin.posture

  get postureString () {
    return JSON.stringify(this.posture)
  }

  set postureString (string) {
    this.posture = JSON.parse(string)
  }

  exportGLTF (fileName, objects = this) {
    const exporter = new GLTFExporter()

    if (!fileName) {
      // if no fileName, return GLTF text
      exporter.parse(
        objects,
        (gltf) => prompt('GLTF text', JSON.stringify(gltf)),
        (error) => { throw error },
        { binary: false }
      )
    } else {
      // there is fileName, check file extension
      const fileExt = fileName.split('.').pop().toUpperCase()
      const binary = fileExt === 'GLB'

      if (fileExt !== 'GLB' && fileExt !== 'GLTF') fileName += '.gltf'

      exporter.parse(
        objects, // objects to export
        (gltf) => {
          const type = binary ? 'application/octet-stream' : 'text/plain;charset=utf-8'
          const data = binary ? gltf : JSON.stringify(gltf)
          const blob = new Blob([data], { type })

          const link = document.createElement('a')
          link.href = URL.createObjectURL(blob)
          link.download = fileName
          link.click()
        },
        (error) => { throw error },
        { binary }
      )
    }
  } // Mannequin.exportGLTF
}

export class Female extends Mannequin {
  constructor (height = 0.95) {
    super(true, height)
    this.body.position.y = 2.2

    this.l_leg.straddle -= 4
    this.r_leg.straddle -= 4

    this.l_ankle.tilt -= 4
    this.r_ankle.tilt -= 4
  } // Female.constructor
} // Female

export class Male extends Mannequin {
  constructor (height = 1) {
    super(false, height)
    this.body.position.y = 3.8

    this.l_leg.straddle += 6
    this.r_leg.straddle += 6

    this.l_ankle.turn += 6
    this.r_ankle.turn += 6

    this.l_ankle.tilt += 6
    this.r_ankle.tilt += 6
  } // Male.constructor
} // Male

export class Child extends Mannequin {
  constructor (height = 0.65) {
    super(false, height)
    this.body.position.y = -12

    this.l_arm.straddle -= 2
    this.r_arm.straddle -= 2
  } // Child.constructor
} // Child

// default body parts colours
Mannequin.colors = [
  'antiquewhite', // head
  'gray', // shoes
  'antiquewhite', // pelvis
  'burlywood', // joints
  'antiquewhite', // limbs
  'bisque', // torso
  'burlywood' // nails
]

// head texture
Mannequin.texHead = new TextureLoader().load('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABABAMAAABYR2ztAAAAGFBMVEX////Ly8v5+fne3t5GRkby8vK4uLi/v7/GbmKXAAAAZklEQVRIx2MYQUAQHQgQVkBtwEjICkbK3MAkQFABpj+R5ZkJKTAxImCFSSkhBamYVgiQrAADEHQkIW+iqiBCAfXjAkMHpgKqgyHgBiwBRfu4ECScYEZGvkD1JxEKhkA5OVTqi8EOAOyFJCGMDsu4AAAAAElFTkSuQmCC')

// limb and body texture
Mannequin.texLimb = new TextureLoader().load('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABAAQMAAACQp+OdAAAABlBMVEX////Ly8vsgL9iAAAAHElEQVQoz2OgEPyHAjgDjxoKGWTaRRkYDR/8AAAU9d8hJ6+ZxgAAAABJRU5ErkJggg==')

// joint object-template
Mannequin.sphereGeometry = new IcosahedronGeometry(1, 3)

// calculate 2cosine-based lump
// params is array of [ [u-min, u-max, v-min, v-max, 1/height], ...]
Mannequin.cossers = function (u, v, params) {
  function cosser (t, min, max) {
    if (t < min) t++
    if (t > max) t--
    if (min <= t && t <= max) { return 0.5 + 0.5 * Math.cos((t - min) / (max - min) * 2 * Math.PI - Math.PI) }
    return 0
  }
  let r = 1
  for (let i = 0; i < params.length; i++) { r += cosser(u, params[i][0], params[i][1]) * cosser(v, params[i][2], params[i][3]) / params[i][4] }
  return r
} // Mannequin.cossers

Mannequin.blend = function (posture0, posture1, k) {
  if (posture0.version !== posture1.version) { throw new Error('Incompatibe posture blending.') }

  function lerp (data0, data1, k) {
    if (data0 instanceof Array) {
      const result = []
      for (const i in data0) { result.push(lerp(data0[i], data1[i], k)) }
      return result
    } else {
      return data0 * (1 - k) + k * data1
    }
  }

  return {
    version: posture1.version,
    data: lerp(posture0.data, posture1.data, k)
  }
} // Mannequin.blend

Mannequin.convert6to7 = function (posture) {
  // 0:y 1:body 2:torso 3:head
  // 4:l_leg 5:l_knee 6:l_ankle
  // 7:r_leg 8:r_knee 9:r_ankle
  // 10:l_arm 11:l_elbow 12:l_wrist 13:l_fingers
  // 14:r_arm 15:r_elbow 16:r_wrist 17:r_fingers

  // {"version": 6, "data": [
  //    0, [1,1,1], [2,2,2], [3,3,3],
  //    [4,4,4], [5], [6,6,6],
  //    [7,7,7], [8], [9,9,9],
  //    [10,10,10], [11], [12,12,12], [13,13],
  //    [14,14,14], [15], [16,16,16], [17,17]
  // ]}
  //
  // {"version":7, "data": [
  //    0, [1,1,1], [2,2,2], [3,3,3],
  //    [4,4,4], [5], [6,6,6],
  //    [7,7,7], [8], [9,9,9],
  //    [10,10,10],[11],[12,12,12],[-90,75,0,10,0,10],[0,10,0,10,0,10],[0,10,0,10,0,10],[0,10,0,10,0,10],[0,10,0,10,0,10],
  //    [-7,0.6,-5],[15],[-5,0,0],[90,75,0,10,0,10],[0,10,0,10,0,10],[0,10,0,10,0,10],[0,10,0,10,0,10],[0,10,0,10,0,10]
  // ]}

  const data = []

  // 0..12
  for (let i = 0; i <= 12; i++) { data.push(posture.data[i]) }

  // 13
  let a = posture.data[13][0]
  let b = posture.data[13][1]

  for (let i = 0; i < 5; i++) { data.push([0, a, 0, b / 2, 0, b / 2]) }

  // 14..16
  for (let i = 14; i <= 16; i++) { data.push(posture.data[i]) }

  // 17
  a = posture.data[17][0]
  b = posture.data[17][1]

  for (let i = 0; i < 5; i++) { data.push([0, a, 0, b / 2, 0, b / 2]) }

  return { version: 7, data }
}

/**
 * creates a 3d scene inside the dom with camera, light, ground, fog and animation
 * @param {HTMLElement} parent
 * @param {Function} animate
 * @param {PerspectiveCamera|undefined} camera
 * @param {Mesh|undefined} ground
 * @returns {{renderer: WebGLRenderer, stop: Function, light: DirectionalLight, start: Function, camera: PerspectiveCamera, scene: Scene}}
 */
export function createScene (parent = document.body, animate = undefined, camera = undefined, ground = undefined) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(parent.clientWidth, parent.clientHeight)
  renderer.domElement.style = 'width: 100%; height: 100%;'
  renderer.shadowMap.enabled = true
  renderer.setPixelRatio(window.devicePixelRatio)
  parent.appendChild(renderer.domElement)

  const scene = new Scene()
  scene.background = null
  scene.background = new Color('gainsboro')
  scene.fog = new Fog('gainsboro', 100, 600)

  if (!camera) camera = frontView(parent)

  const light = new DirectionalLight('white', 3)
  light.position.set(0, 25, 50)
  scene.add(light, new HemisphereLight(0xaaaaaa, 0x444444, 3))

  function resize () {
    camera.aspect = parent.clientWidth / parent.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(parent.clientWidth, parent.clientHeight, true)
    renderer.render(scene, camera)
  }

  new ResizeObserver(resize).observe(parent)
  resize()

  if (!ground) {
    ground = planeGround()
  }
  scene.add(ground)

  const clock = animate ? new Clock() : null

  function drawFrame () {
    animate(100 * clock.getElapsedTime(), { renderer, scene, camera, light, ground })
    renderer.render(scene, camera)
  }

  function start () {
    renderer.setAnimationLoop(drawFrame)
  }

  function stop () {
    renderer.setAnimationLoop(null)
  }

  if (animate) start()

  return { renderer, scene, camera, light, ground, start, stop }
}

/**
 * default camera view
 * @returns {PerspectiveCamera}
 */
export function frontView (parent) {
  const camera = new PerspectiveCamera(30, parent.innerWidth / parent.innerHeight, 0.1, 2000)
  camera.position.set(0, 0, 150)
  return camera
}

/**
 * default plane ground
 * @param {number} radius
 * @param {string} color
 * @returns {Mesh}
 */
export function planeGround (radius = 20, color = 'antiquewhite') {
  const ground = new Mesh(
    new PlaneGeometry(1000, 1000),
    new MeshLambertMaterial({ color })
  )
  ground.receiveShadow = true
  ground.position.y = -29.5
  ground.rotation.x = -Math.PI / 2

  return ground
}
