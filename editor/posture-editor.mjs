import {
  CanvasTexture,
  ConeGeometry,
  DoubleSide,
  MeshBasicMaterial,
  MeshPhongMaterial,
  Raycaster,
  Scene,
  TorusGeometry,
  UVMapping,
  Vector2,
  Vector3,
  Mesh,
  CircleGeometry
} from '../libs/three.mjs'
import {
  Male,
  Female,
  Ankle,
  Head,
  Pelvis,
  Torso,
  Wrist,
  Mannequin,
  MannequinPostureVersionError,
  planeGround,
  createScene
} from '../mannequin.mjs'
import { OrbitControls } from '../libs/OrbitControls.mjs'

const EPS = 0.00001

// name body parts and their motions
const names = [
  ['body', 'tilt', 'turn', 'bend'],
  ['pelvis', 'tilt', 'turn', 'bend'],
  ['torso', 'tilt', 'turn', 'bend'],
  ['neck', 'tilt', 'turn', 'nod'],
  ['head', 'tilt', 'turn', 'nod'],
  ['l_leg', 'straddle', 'turn', 'raise'],
  ['l_knee', '', '', 'bend'],
  ['l_ankle', 'tilt', 'turn', 'bend'],
  ['l_arm', 'straddle', 'turn', 'raise'],
  ['l_elbow', '', '', 'bend'],
  ['l_wrist', 'tilt', 'turn', 'bend'],
  ['l_finger_0', 'straddle', 'turn', 'bend'],
  ['l_finger_1', 'straddle', '', 'bend'],
  ['l_finger_2', 'straddle', '', 'bend'],
  ['l_finger_3', 'straddle', '', 'bend'],
  ['l_finger_4', 'straddle', '', 'bend'],
  ['l_mid_0', '', '', 'bend'],
  ['l_mid_1', '', '', 'bend'],
  ['l_mid_2', '', '', 'bend'],
  ['l_mid_3', '', '', 'bend'],
  ['l_mid_4', '', '', 'bend'],
  ['l_tip_0', '', '', 'bend'],
  ['l_tip_1', '', '', 'bend'],
  ['l_tip_2', '', '', 'bend'],
  ['l_tip_3', '', '', 'bend'],
  ['l_tip_4', '', '', 'bend'],
  ['r_leg', 'straddle', 'turn', 'raise'],
  ['r_knee', '', '', 'bend'],
  ['r_ankle', 'tilt', 'turn', 'bend'],
  ['r_arm', 'straddle', 'turn', 'raise'],
  ['r_elbow', '', '', 'bend'],
  ['r_wrist', 'tilt', 'turn', 'bend'],
  ['r_finger_0', 'straddle', 'turn', 'bend'],
  ['r_finger_1', 'straddle', '', 'bend'],
  ['r_finger_2', 'straddle', '', 'bend'],
  ['r_finger_3', 'straddle', '', 'bend'],
  ['r_finger_4', 'straddle', '', 'bend'],
  ['r_mid_0', '', '', 'bend'],
  ['r_mid_1', '', '', 'bend'],
  ['r_mid_2', '', '', 'bend'],
  ['r_mid_3', '', '', 'bend'],
  ['r_mid_4', '', '', 'bend'],
  ['r_tip_0', '', '', 'bend'],
  ['r_tip_1', '', '', 'bend'],
  ['r_tip_2', '', '', 'bend'],
  ['r_tip_3', '', '', 'bend'],
  ['r_tip_4', '', '', 'bend']
]

export class PostureEditor extends HTMLElement {
  get css () {
    return `
      :host {
        position: relative;
        display: inline-block;
        width: 100%;
        height: 100%;
      }
      
      #editor {
        width: 100%;
        height: 100%;
      }
      
      input[type=checkbox] {
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        -webkit-tap-highlight-color: transparent;
        outline: 0;
      }
      
      span.short {
        display: inline-block;
        width: 2em;
        text-align: right;
      }
      
      .panel {
        margin: 0.3em;
        padding: 0.3em;
        width: 12em;
        position: absolute;
        top: 0;
        z-index: 10;
        border-radius: 1em;
        background: rgba(0, 0, 0, 0.01);
        border: solid 1px rgba(0, 0, 0, 0.05);
        box-shadow: inset 0 0 0.1em rgba(0, 0, 0, 0.1);
        backdrop-filter: blur(0.3em);
      }
      
      hr {
        margin-bottom: 1em;
        border: 0;
        height: 1px;
        background-image: linear-gradient(to right, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.1));
      }
      
      label {
        cursor: pointer;
        display: inline-block;
        margin-bottom: 10px;
        z-index: 10;
      }
      
      button,
      label span,
      .button-group {
        font-size: 0.75em;
        font-family: Sans-serif;
        font-weight: bold;
        display: inline-block;
        margin-left: 5px;
        text-transform: uppercase;
        letter-spacing: 1px;
        vertical-align: middle;
        color: white;
        text-shadow: 0 0 0.2em gray;
      }
      
      .button-group {
        width: 100%;
      }
      
      button,
      .toggle {
        height: 24px;
        width: 56px;
        border-radius: 12px;
        display: inline-block;
        position: relative;
        margin: 0;
        padding: 0;
        border: 1px solid gray;
        background: rgba(0, 0, 0, 3%);
        vertical-align: middle;
      }
      
      button {
        height: 28px;
        width: 100%;
        color: black;
        margin: 0.5em 0;
        font-size: 1em;
      }
      
      button:hover {
        cursor: pointer;
        background: seagreen;
      }
      
      .button-group:hover {
        color: black;
      }
      
      .toggle:after {
        content: "";
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 10%);
        border: solid 1px gray;
      }
      
      :checked+span,
      :checked+span+span,
      :checked+span+span+span {
        color: black;
        font-weight: bold;
        text-shadow: 0 0 0.1em dimgray;
      }
      
      .toggle:checked:after {
        border-color: darkgreen;
        background: seagreen;
        transform: translatex(32px);
      }
      
      textarea {
        z-index: -1;
      }
    `
  }

  get html () {
    return `
      <div class="panel" style="left: 0; width: 9em;">
         <label><input id="inverse-kinematics" type="checkbox" class="toggle"><span>Inverse<br>kinematics</span></label><br>
         <label><input id="biological-constraints" type="checkbox" class="toggle" checked><span>Biological<br>constraints</span></label><hr>
         <label><input id="rot-z" type="checkbox" class="toggle" checked><span id="rot-z-name">N/A</span></label><br>
         <label><input id="rot-x" type="checkbox" class="toggle"><span id="rot-x-name">N/A</span></label><br>
         <label><input id="rot-y" type="checkbox" class="toggle"><span id="rot-y-name">N/A</span></label><hr>
         <label><input id="mov-x" type="checkbox" class="toggle"><span>Move X</span></label><br>
         <label><input id="mov-y" type="checkbox" class="toggle"><span>Move Y</span></label><br>
         <label><input id="mov-z" type="checkbox" class="toggle"><span>Move Z</span></label><br>
      </div>
      <div class="panel" style="right: 0; width: 5em;">
        <span class="button-group">Posture
          <button id="gp">Get</button><br>
          <button id="sp">Set</button><br>
          <button id="ep">Export</button><br>
        </span>
        <hr>
        <span class="button-group">Figure
          <button id="am">Add</button><br>
          <button id="rm">Remove</button><br>
        </span>
      </div>
      <div id="editor"></div>`
  }

  connectedCallback () {
    this.attachShadow({ mode: 'open' })
    this.shadowRoot.innerHTML = `<style>${this.css}</style>${this.html}`

    const animate = this.setupInteraction()
    Object.assign(this, createScene(this.element('editor'), animate, undefined, planeGround())) // renderer, camera,
    // scene, light, start, stop
    this.models = []
    this.model = this.addModel()

    this.gauge = this.initGaugeIndicator(this.renderer)
    this.controls = this.initControls(this.renderer)

    this.element('rot-z').checked = true
  }

  initControls () {
    const controls = new OrbitControls(this.camera, this.renderer.domElement)
    controls.minPolarAngle = 0
    controls.maxPolarAngle = Math.PI / 2
    controls.maxDistance = 200

    controls.addEventListener('start', () => this.start())
    controls.addEventListener('end', () => {
      this.stop()
      this.renderer.render(this.scene, this.camera)
    })
    return controls
  }

  initGaugeIndicator () {
    // create gauge indicator
    const gauge = new Mesh(
      new CircleGeometry(10, 32, 9 / 4 * Math.PI, Math.PI / 2),
      new MeshPhongMaterial({
        side: DoubleSide,
        color: 'blue',
        transparent: true,
        opacity: 0.75,
        alphaMap: gaugeTexture(256, this.renderer.capabilities.getMaxAnisotropy())
      })
    )
    const gaugeMaterial = new MeshBasicMaterial({ color: 'navy' })

    gauge.add(new Mesh(new TorusGeometry(10, 0.1, 8, 32, Math.PI / 2).rotateZ(Math.PI / 4), gaugeMaterial))
    gauge.add(new Mesh(new ConeGeometry(0.7, 3, 6).translate(-10, 0, 0).rotateZ(5 * Math.PI / 4), gaugeMaterial))
    gauge.add(new Mesh(new ConeGeometry(0.7, 3, 6).translate(10, 0, 0).rotateZ(3 * Math.PI / 4), gaugeMaterial))

    return gauge
  }

  addModel (male = true) {
    const model = male ? new Male() : new Female()

    model.l_mid_0 = model.l_finger_0.mid
    model.l_mid_1 = model.l_finger_1.mid
    model.l_mid_2 = model.l_finger_2.mid
    model.l_mid_3 = model.l_finger_3.mid
    model.l_mid_4 = model.l_finger_4.mid

    model.r_mid_0 = model.r_finger_0.mid
    model.r_mid_1 = model.r_finger_1.mid
    model.r_mid_2 = model.r_finger_2.mid
    model.r_mid_3 = model.r_finger_3.mid
    model.r_mid_4 = model.r_finger_4.mid

    model.l_tip_0 = model.l_finger_0.tip
    model.l_tip_1 = model.l_finger_1.tip
    model.l_tip_2 = model.l_finger_2.tip
    model.l_tip_3 = model.l_finger_3.tip
    model.l_tip_4 = model.l_finger_4.tip

    model.r_tip_0 = model.r_finger_0.tip
    model.r_tip_1 = model.r_finger_1.tip
    model.r_tip_2 = model.r_finger_2.tip
    model.r_tip_3 = model.r_finger_3.tip
    model.r_tip_4 = model.r_finger_4.tip

    for (const nameData of names) {
      const name = nameData[0]
      for (const part of model[name].children[0].children) { part.name = name }
      for (const part of model[name].children[0].children[0].children) { part.name = name }
      if (model[name].children[0].children[1]) {
        for (const part of model[name].children[0].children[1].children) { part.name = name }
      }
      model[name].nameUI = {
        x: nameData[1],
        y: nameData[2],
        z: nameData[3]
      }
    }

    this.models.push(model)
    this.scene.add(model)
    this.renderer.render(this.scene, this.camera)

    return model
  }

  removeModel () {
    if (!this.model) return
    this.scene.remove(this.model)
    this.models = this.models.filter(model => model !== this.model)

    if (this.models.length > 0) { this.model = this.models[0] } else { this.model = null }

    this.renderer.render(this.scene, this.camera)
  }

  getPosture () {
    if (!this.model) return

    prompt('The current posture is shown below. Copy it to the clipboard.', this.model.postureString)
  }

  setPosture () {
    if (!this.model) return

    const string = prompt('Reset the posture to:', '{"version":7,"data":["0,[0,0,0],...]}')

    if (string) {
      const oldPosture = this.model.posture

      try {
        this.model.postureString = string
      } catch (error) {
        this.model.posture = oldPosture
        if (error instanceof MannequinPostureVersionError) { alert(error.message) } else { alert('The provided posture was either invalid or impossible to understand.') }
        console.error(error)
      }
      this.renderer.render(this.scene, this.camera)
    }
  }

  exportPosture () {
    if (!this.model) return

    console.log(this.models)
    this.model.exportGLTF('mannequin.glb', this.models)
  }

  setupInteraction () {
    const mouse = new Vector2() // mouse 3D position
    let mouseButton // pressed mouse buttons
    const raycaster = new Raycaster() // raycaster to grab body part
    const dragPoint = new Mesh() // point of grabbing
    let selected // currently selected body part
    let dragged // currently dragged body part
    let oldParentAngle

    const processCheckBoxes = event => {
      if (event) {
        if (event.target.checked) {
          cbRotX.checked = cbRotY.checked = cbRotY.checked = cbRotZ.checked = cbMovX.checked = cbMovY.checked = cbMovZ.checked = false
          event.target.checked = true
        }
      }

      if (!selected) return

      if (cbRotZ.checked) {
        selected.rotation.reorder('XYZ')
      }

      if (cbRotX.checked) {
        selected.rotation.reorder('YZX')
      }

      if (cbRotY.checked) {
        selected.rotation.reorder('ZXY')
      }
    }

    const onPointerUp = () => {
      this.controls.enabled = true
      mouseButton = undefined
      deselect()
      this.stop()
      this.renderer.render(this.scene, this.camera)
    }

    const select = object => {
      deselect()
      dragged = object
      dragged?.select(true)
    }

    const deselect = () => {
      this.gauge.parent?.remove(this.gauge)
      dragged?.select(false)
      dragged = undefined
    }

    const onPointerDown = event => {
      userInput(event)

      this.gauge.parent?.remove(this.gauge)
      dragPoint.parent?.remove(dragPoint)

      raycaster.setFromCamera(mouse, this.camera)

      const intersects = raycaster.intersectObjects(this.models, true)

      if (intersects.length && (intersects[0].object.name || intersects[0].object.parent.name)) {
        this.controls.enabled = false

        let scanObj
        for (scanObj = intersects[0].object; !(scanObj instanceof Mannequin) && !(scanObj instanceof Scene); scanObj = scanObj?.parent) {
          // empty
        }

        if (scanObj instanceof Mannequin) this.model = scanObj

        let name = intersects[0].object.name || intersects[0].object.parent.name

        if (name === 'neck') name = 'head'
        if (name === 'pelvis') name = 'body'

        select(this.model[name])

        this.element('rot-x-name').innerHTML = this.model[name].nameUI.x || 'N/A'
        this.element('rot-y-name').innerHTML = this.model[name].nameUI.y || 'N/A'
        this.element('rot-z-name').innerHTML = this.model[name].nameUI.z || 'N/A'

        dragPoint.position.copy(dragged.worldToLocal(intersects[0].point))
        dragged.imageWrapper.add(dragPoint)

        if (!cbMovX.checked && !cbMovY.checked && !cbMovZ.checked) dragged.imageWrapper.add(this.gauge)
        this.gauge.position.y = (dragged instanceof Ankle) ? 2 : 0

        processCheckBoxes()
      }
      this.start()
    }

    const onPointerMove = event => {
      if (dragged) userInput(event)
    }

    const eventToRelative = (event, wrapper) => {
      const rect = wrapper.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      return { x, y }
    }

    const userInput = event => {
      event.preventDefault()

      mouseButton = event.buttons || 0x1

      const editor = this.element('editor')
      const { x, y } = eventToRelative(event, editor)
      mouse.x = x / editor.clientWidth * 2 - 1
      mouse.y = -y / editor.clientHeight * 2 + 1
    }

    const relativeTurn = (joint, rotationalAngle, angle) => {
      if (rotationalAngle.startsWith('position.')) {
        // it is translation, not rotation
        rotationalAngle = rotationalAngle.split('.').pop()
        joint.position[rotationalAngle] += angle
        return
      }

      if (joint.biologicallyImpossibleLevel) {
        if (cbBiologicalConstraints.checked) {
          // there is a dedicated function to check biological possibility of joint
          const oldImpossibility = joint.biologicallyImpossibleLevel()

          joint[rotationalAngle] += angle
          joint.updateMatrix()
          joint.updateWorldMatrix(true) // ! important, otherwise get's stuck

          const newImpossibility = joint.biologicallyImpossibleLevel()

          if (newImpossibility > EPS && newImpossibility >= oldImpossibility - EPS) {
            // undo rotation
            joint[rotationalAngle] -= angle
            return
          }
        } else {
          joint.biologicallyImpossibleLevel()
          joint[rotationalAngle] += angle
        }
        // keep the rotation, it is either possible, or improves impossible situation
      } else {
        // there is no dedicated function, test with individual rotation range
        const val = joint[rotationalAngle] + angle
        const min = joint.minRot[rotationalAngle]
        const max = joint.maxRot[rotationalAngle]

        if (val < min - EPS && angle < 0) return
        if (val > max + EPS && angle > 0) return
        if (min === max) return

        joint[rotationalAngle] = val
      }
      joint.updateMatrix()
    } // relativeTurn

    const kinematic2D = (joint, rotationalAngle, angle, ignoreIfPositive) => {
      // returns >0 if this turn gets closer

      // swap Z<->X for wrist
      if (joint instanceof Wrist) {
        if (rotationalAngle === 'x') { rotationalAngle = 'z' } else if (rotationalAngle === 'z') { rotationalAngle = 'x' }
      }

      let screenPoint = new Vector3().copy(dragPoint.position)
      screenPoint = dragged.localToWorld(screenPoint).project(this.camera)

      const distOriginal = mouse.distanceTo(screenPoint)
      const oldAngle = joint[rotationalAngle]

      if (joint instanceof Head) { // head and neck
        oldParentAngle = joint.parentJoint[rotationalAngle]
        relativeTurn(joint, rotationalAngle, angle / 2)
        relativeTurn(joint.parentJoint, rotationalAngle, angle / 2)
        joint.parentJoint.updateMatrixWorld(true)
      } else {
        relativeTurn(joint, rotationalAngle, angle)
      }
      joint.updateMatrixWorld(true)

      screenPoint.copy(dragPoint.position)
      screenPoint = dragged.localToWorld(screenPoint).project(this.camera)

      const distProposed = mouse.distanceTo(screenPoint)
      const dist = distOriginal - distProposed

      if (ignoreIfPositive && dist > 0) return dist

      joint[rotationalAngle] = oldAngle
      if (joint instanceof Head) { // head and neck
        joint.parentJoint[rotationalAngle] = oldParentAngle
      }
      joint.updateMatrixWorld(true)

      return dist
    }

    const inverseKinematics = (joint, rotationalAngle, step) => {
      // try going in postive or negative direction
      const kPos = kinematic2D(joint, rotationalAngle, 0.001)
      const kNeg = kinematic2D(joint, rotationalAngle, -0.001)

      // if any of them improves closeness, then turn in this direction
      if (kPos > 0 || kNeg > 0) {
        if (kPos < kNeg) step = -step
        kinematic2D(joint, rotationalAngle, step, true)
      }
    }

    const cbInverseKinematics = this.element('inverse-kinematics')
    const cbBiologicalConstraints = this.element('biological-constraints')
    const cbRotZ = this.element('rot-z')
    const cbRotX = this.element('rot-x')
    const cbRotY = this.element('rot-y')
    const cbMovZ = this.element('mov-z')
    const cbMovX = this.element('mov-x')
    const cbMovY = this.element('mov-y')
    const btnGetPosture = this.element('gp')
    const btnSetPosture = this.element('sp')
    const btnExportPosture = this.element('ep')
    const btnAddModel = this.element('am')
    const btnRemoveModel = this.element('rm')

    // set up event handlers
    this.addEventListener('pointerdown', onPointerDown)
    this.addEventListener('pointerup', onPointerUp)
    this.addEventListener('pointermove', onPointerMove)

    for (const cb of [cbRotX, cbRotY, cbRotZ, cbMovX, cbMovY, cbMovZ]) { cb.addEventListener('click', processCheckBoxes) }

    btnGetPosture.addEventListener('click', () => this.getPosture())
    btnSetPosture.addEventListener('click', () => this.setPosture())
    btnExportPosture.addEventListener('click', () => this.exportPosture())
    btnAddModel.addEventListener('click', () => this.addModel())
    btnRemoveModel.addEventListener('click', () => this.removeModel())

    // return the animate function
    return () => {
      // no selected object
      if (!dragged || !mouseButton) return

      const elemNone = !cbRotZ.checked && !cbRotX.checked && !cbRotY.checked && !cbMovX.checked && !cbMovY.checked && !cbMovZ.checked
      const spinA = (dragged instanceof Ankle) ? Math.PI / 2 : 0

      this.gauge.rotation.set(0, 0, -spinA)
      if (cbRotX.checked || (elemNone && mouseButton & 0x2)) this.gauge.rotation.set(0, Math.PI / 2, 2 * spinA)
      if (cbRotY.checked || (elemNone && mouseButton & 0x4)) this.gauge.rotation.set(Math.PI / 2, 0, -Math.PI / 2)

      let joint = (cbMovX.checked || cbMovY.checked || cbMovZ.checked) ? this.model.body : dragged

      do {
        for (let step = 5; step > 0.1; step *= 0.75) {
          if (cbRotZ.checked || (elemNone && (mouseButton & 0x1))) { inverseKinematics(joint, 'z', step) }
          if (cbRotX.checked || (elemNone && (mouseButton & 0x2))) { inverseKinematics(joint, 'x', step) }
          if (cbRotY.checked || (elemNone && (mouseButton & 0x4))) { inverseKinematics(joint, 'y', step) }

          if (cbMovX.checked) { inverseKinematics(joint, 'position.x', step) }
          if (cbMovY.checked) { inverseKinematics(joint, 'position.y', step) }
          if (cbMovZ.checked) { inverseKinematics(joint, 'position.z', step) }
        }

        joint = joint.parentJoint
      }
      while (joint && !(joint instanceof Mannequin) && !(joint instanceof Pelvis) && !(joint instanceof Torso) && cbInverseKinematics.checked)
    }
  }

  element (name) {
    return this.shadowRoot.getElementById(name)
  }
}

/**
 * Generate a gauge texture for supporting drag operations
 * @param {number} size
 * @param {boolean} anisotropy
 * @returns {CanvasTexture}
 */
function gaugeTexture (size = 256, anisotropy) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const r = size / 2

  const context = canvas.getContext('2d')
  context.fillStyle = 'black'
  context.fillRect(0, 0, size, size)

  const gradient = context.createRadialGradient(r, r, r / 2, r, r, r)
  gradient.addColorStop(0, 'black')
  gradient.addColorStop(1, 'gray')

  // Fill with gradient
  context.fillStyle = gradient
  context.fillRect(1, 1, size - 2, size - 2)

  const start = Math.PI; const end = 2 * Math.PI

  context.strokeStyle = 'white'
  context.lineWidth = 1
  context.beginPath()
  for (let rr = r; rr > 0; rr -= 25) { context.arc(size / 2, size / 2, rr, start, end) }

  for (let i = 0; i <= 12; i++) {
    context.moveTo(r, r)
    const a = start + i / 12 * (end - start)
    context.lineTo(r + r * Math.cos(a), r + r * Math.sin(a))
  }
  context.stroke()

  const texture = new CanvasTexture(canvas, UVMapping)
  texture.anisotropy = anisotropy
  texture.repeat.set(1, 1)

  return texture
}
