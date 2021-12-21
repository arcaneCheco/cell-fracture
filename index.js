import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { Pane } from "tweakpane";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import GSAP from "gsap";

class World {
  constructor() {
    this.container = document.querySelector("#webgl");
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.duration = 10.416666984558105;
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(
      65,
      this.width / this.height,
      0.1,
      1000
    );
    this.camera.position.set(0, 1.5, 1.5);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    // this.addDebug();
    this.setMaterials();
    this.setDummyEmitter();
    this.setLight();
    this.setParticles();
    this.setPost();
    this.addObject();
    document
      .querySelectorAll(".tp-lblv_v")
      .forEach((element) => (element.style.width = "25vw"));
    this.render();
  }

  addDebug() {
    this.debug = new Pane();
    this.debug.containerElem_.style.width = "30vw";
    this.debug.containerElem_.style.minWidth = "320px";
    this.debugFolder = this.debug.addFolder({ title: "tweaks" });
    this.progress = 0;

    if (this.debug) {
      this.debugFolder
        .addInput(this, "progress", { min: 0, max: 0.999, step: 0.0001 })
        .on("change", () => {
          this.mixer.setTime(this.progress * this.duration);
        });
    }
  }

  setMaterials() {
    this.insideMaterial = new THREE.MeshPhysicalMaterial({
      roughness: 0.5,
      color: new THREE.Color("blue").convertGammaToLinear(),
      transparent: true,
      transmission: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0,
      metalness: 0.5,
    });
    this.outsideMaterial = new THREE.MeshStandardMaterial();
  }

  setLight() {
    this.pointLight = new THREE.PointLight(0x0000ff, 2);
    this.pointLight.decay = 2;
    this.pointLight.distance = 10;
    this.scene.add(this.pointLight);
    const rectLight = new THREE.RectAreaLight(0xffffff, 10, 15, 15);
    rectLight.position.set(-20, 20, -20);
    rectLight.lookAt(0, 0, 0);
    this.scene.add(rectLight);

    if (this.debug) {
      this.debugFolder.addInput(this.pointLight, "intensity", {
        min: 0,
        max: 10,
        step: 0.01,
      });
    }
  }

  addObject() {
    this.mixer = null;

    this.modelLoader = new GLTFLoader();

    this.modelLoader.load("initial.glb", (gltf) => {
      console.log(gltf);
      gltf.scene.children.forEach((child) => {
        if (child.type === "Mesh") {
          child.material = this.insideMaterial;
        } else {
          if (child.children[0].material.name === "outside") {
            child.children[0].material = this.outsideMaterial;
            child.children[1].material = this.insideMaterial;
          } else {
            child.children[1].material = this.outsideMaterial;
            child.children[0].material = this.insideMaterial;
          }
        }
      });
      this.model = gltf.scene;

      this.scene.add(gltf.scene);

      this.mixer = new THREE.AnimationMixer(gltf.scene);

      this.actions = [];
      gltf.animations.forEach((animation) => {
        const action = this.mixer.clipAction(animation);
        this.actions.push(action);
        action.play();
        action.clampWhenFinished = true;
      });
      this.setAnimation();
    });
  }

  setParticles() {
    const geometry = new THREE.BufferGeometry();
    this.count = 1000;
    this.boxSize = 15;
    const positionArray = new Float32Array(this.count * 3);
    const randArray = new Float32Array(this.count);

    for (let i = 0; i < this.count; i++) {
      positionArray[i * 3] = (Math.random() - 0.5) * this.boxSize;
      positionArray[i * 3 + 1] = -3;
      positionArray[i * 3 + 2] = (Math.random() - 0.5) * this.boxSize;

      randArray[i] = Math.random();
    }

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positionArray, 3)
    );
    geometry.setAttribute(
      "aRand",
      new THREE.Float32BufferAttribute(randArray, 1)
    );

    this.pointsMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        uniform float uTime;

        attribute float aRand;

        void main() {

            vec3 pos = position;
            pos.y += (uTime*0.4+15.) * (aRand+0.1);
            pos.y = mod(pos.y, 12.) -3.;
            vec4 modelViewPosition = modelViewMatrix * vec4(pos, 1.);
            gl_Position = projectionMatrix * modelViewPosition;

            gl_PointSize = 30.;
            gl_PointSize *= 1. / -modelViewPosition.z;
        }`,
      fragmentShader: `
        uniform float uTime;

        void main() {
            float strength = distance(gl_PointCoord, vec2(0.5));
            strength = pow(1. - strength, 7.);
            gl_FragColor = vec4(vec3(1.), strength);
        }`,
      transparent: true,
      uniforms: {
        uTime: {
          value: 0,
        },
      },
    });
    this.points = new THREE.Points(geometry, this.pointsMaterial);
    this.scene.add(this.points);
  }

  setDummyEmitter() {
    this.overlay = new THREE.Mesh(
      new THREE.SphereGeometry(1.0001),
      new THREE.MeshStandardMaterial({ transparent: true })
    );
    this.scene.add(this.overlay);
    this.materials = {};
    this.darkMaterial = new THREE.MeshBasicMaterial({ color: "black" });
    const BLOOM_SCENE = 1;
    this.bloomLayer = new THREE.Layers();
    this.bloomLayer.set(BLOOM_SCENE);

    const geometry = new THREE.SphereGeometry(0.2, 20, 20);
    this.material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x0000ff),
      transparent: true,
      opacity: 1,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.layers.enable(BLOOM_SCENE);
    this.scene.add(this.mesh);

    this.scale = 1;

    if (this.debug) {
      this.debugFolder
        .addInput(this, "scale", {
          min: 0,
          max: 10,
          step: 0.01,
        })
        .on("change", () =>
          this.mesh.scale.set(this.scale, this.scale, this.scale)
        );
    }
  }

  setPost() {
    // render-pass
    this.renderPass = new RenderPass(this.scene, this.camera);

    // bloom
    this.bloomComposer = new EffectComposer(this.renderer);
    this.bloomComposer.renderToScreen = false;
    this.bloomComposer.addPass(this.renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.width, this.height),
      1.5,
      0.4,
      0.85
    );
    bloomPass.threshold = 0;
    bloomPass.strength = 5;
    bloomPass.radius = 0;
    this.bloomComposer.addPass(bloomPass);

    this.exposure = 0;

    if (this.debug) {
      this.debugFolder.addInput(bloomPass, "strength", {
        min: 0,
        max: 50,
        step: 0.01,
      });
      this.debugFolder.addInput(bloomPass, "threshold", {
        min: 0,
        max: 50,
        step: 0.01,
      });
      this.debugFolder.addInput(bloomPass, "radius", {
        min: 0,
        max: 50,
        step: 0.01,
      });
      this.debugFolder
        .addInput(this, "exposure", {
          min: 0.1,
          max: 6,
          step: 0.001,
        })
        .on(
          "change",
          () =>
            (this.renderer.toneMappingExposure = Math.pow(this.exposure, 4.0))
        );
    }

    // final
    this.finalComposer = new EffectComposer(this.renderer);
    this.finalComposer.addPass(this.renderPass);

    this.finalEffect = new THREE.ShaderMaterial({
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: this.bloomComposer.renderTarget2.texture },
      },
      vertexShader: `
      varying vec2 vUv;

    		void main() {

    			vUv = uv;

    			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

    		}`,
      fragmentShader: `
            uniform sampler2D baseTexture;
    		uniform sampler2D bloomTexture;

    		varying vec2 vUv;

    		void main() {

    			gl_FragColor = ( texture2D( baseTexture, vUv ) + vec4( 1.0 ) * texture2D( bloomTexture, vUv ) );
    		}`,
      defines: {},
    });

    const finalPass = new ShaderPass(this.finalEffect, "baseTexture");
    finalPass.needsSwap = true;
    this.finalComposer.addPass(finalPass);
  }

  setAnimationIn() {
    let i = 0;

    GSAP.to(this.camera.position, {
      duration: 1.2,
      x: 0,
      y: 1,
      z: 1,
      delay: 0,
      ease: "expo.out",
    });

    GSAP.to(this.camera.position, {
      duration: 1.2,
      x: 0,
      y: 1,
      z: 1,
      delay: 0,
      ease: "expo.out",
    });

    this.model.traverse((obj) => {
      const timeline = GSAP.timeline();

      timeline.to(obj.position, {
        duration: 1.2,
        x: 0,
        y: 0,
        z: 0,
        delay: i * 0.005,
        ease: "expo.out",
        onUpdate: () => {
          obj.rotation.x += 0.01;
          obj.rotation.y += 0.01;
          obj.rotation.z += 0.01;
        },
      });
      timeline.to(
        obj.scale,
        {
          duration: 1.2,
          x: 0.051,
          y: 0.051,
          z: 0.051,
          delay: i * 0.005,
          ease: "expo.out",
        },
        ">"
      );
      i++;
    });
  }

  setAnimation() {
    this.timeline = GSAP.timeline({
      delay: 2,
      onComplete: () => this.setAnimationIn(),
    });

    this.timeline.to(
      this.model.scale,
      {
        x: 1.1,
        y: 1.1,
        z: 1.1,
        duration: 0.2,
        onStart: () => (this.renderer.toneMappingExposure = 0),
      },
      ">"
    );

    this.timeline.to(
      this.model.rotation,
      {
        x: 0.05,
        y: 0.05,
        z: 0.05,
        duration: 0.2,
      },
      "<"
    );

    this.timeline.to(
      this.model.scale,
      {
        x: 1.0,
        y: 1.0,
        z: 1.0,
        duration: 0.2,
        onStart: () => this.scene.remove(this.overlay),
      },
      ">"
    );

    this.timeline.to(
      this.model.rotation,
      {
        x: 0.0,
        y: 0.0,
        z: 0.0,
        duration: 0.2,
      },
      "<"
    );

    this.timeline.to(
      this.renderer,
      {
        duration: 1,
        toneMappingExposure: Math.pow(4, 4.0),
        ease: "expo.in",
      },
      ">+=1"
    );

    this.timeline.to(
      this,
      {
        progress: 0.999,
        ease: "expo.out",
        onUpdate: () => {
          this.mixer.setTime(this.progress * this.duration);
        },
        duration: 5,
        onStart: () => (this.renderer.toneMappingExposure = 2),
      },
      "+=1"
    );

    this.timeline.to(
      this.camera.position,
      {
        y: 5,
        z: 6,
        ease: "expo.out",
        duration: 5,
        onStart: () => (this.animatingCamera = true),
      },
      "<+=0"
    );
  }

  render() {
    this.scene.rotateY(0.002);
    this.animatingCamera && this.scene.rotateY(0.006);
    this.pointsMaterial.uniforms.uTime.value += 0.01;

    this.scene.traverse((obj) => {
      if (
        (obj instanceof THREE.Mesh || obj instanceof THREE.Points) &&
        this.bloomLayer.test(obj.layers) === false
      ) {
        this.materials[obj.uuid] = obj.material;
        obj.material = this.darkMaterial;
      }
    });
    this.bloomComposer.render();
    this.scene.traverse((obj) => {
      if (this.materials[obj.uuid]) {
        obj.material = this.materials[obj.uuid];
        delete this.materials[obj.uuid];
      }
    });
    this.finalComposer.render();
    window.requestAnimationFrame(this.render.bind(this));
  }
}

new World();
