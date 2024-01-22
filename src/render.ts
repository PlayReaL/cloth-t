import { RefObject } from "react";

import { vec3, mat4 } from "wgpu-matrix";
import mesh from "./mesh.ts";

import vertexShaderCode from "./shaders/vert.wgsl?raw";
import fragmentShaderCode from "./shaders/frag.wgsl?raw";
import computeShaderCode from "./shaders/compute.wgsl?raw";

let canvas: HTMLCanvasElement | null;
let bInitialized = false;

let bMousePressed = false;
let angleYaw: number = 0;
let anglePitch: number = -0.7;
let mouseLastX: number;
let mouseLastY: number;
let armLength: number = 2.5;

let currSubdiv: number = 0;
let newSubdiv: number = 10;

const vertexBuffer: GPUBuffer[] = new Array(2);
const vertexBindGroup: GPUBindGroup[] = new Array(2);
let indexBuffer: GPUBuffer;
let numToDraw: number;
let p = 0;

let lastFrameTime: number = 0;

let gravity: number = 0;
let centerOffset: number = 0;

async function init(
  canvasRef: RefObject<HTMLCanvasElement>,
  props: { width: number; height: number },
) {
  // react dev double load workaround
  if (bInitialized) {
    return;
  }
  bInitialized = true;

  canvas = canvasRef.current;
  if (!canvas) {
    console.log("Null canvas ref");
    return;
  }
  const context = canvas.getContext("webgpu");
  if (!context) {
    console.log("WebGPU not supported - failed to get webgpu context");
    return;
  }
  //@TODO get performance/low-power, handle device lost
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    console.log("WebGPU not supported - failed to get webgpu device");
    return;
  }

  //@TODO devicePixelRatio and window.matchMedia() changes
  canvas.width = props.width;
  canvas.height = props.height;
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  const swapChainDesc: GPUCanvasConfiguration = {
    device,
    format: presentationFormat,
  };
  context.configure(swapChainDesc);

  const computePipeline = device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({
        code: computeShaderCode,
      }),
      entryPoint: "main",
    },
  });
  const computePassDescriptor: GPUComputePassDescriptor = {};

  const simParamBufferSize = 4 * 4;
  const simParamBuffer = device.createBuffer({
    size: simParamBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  createVertexIndexBuffer();

  const vertexShader = device?.createShaderModule({ code: vertexShaderCode });
  const fragmentShader = device?.createShaderModule({
    code: fragmentShaderCode,
  });

  const vertexBufferLayout: GPUVertexBufferLayout = {
    // arrayStride: 4 * 4,
    arrayStride: 8 * 4,
    stepMode: "vertex",
    attributes: [
      {
        shaderLocation: 0,
        offset: 0,
        format: "float32x4",
      },
    ],
  };
  const pipelineDesc: GPURenderPipelineDescriptor = {
    layout: "auto", //@TODO replace for explicit declaration
    vertex: {
      module: vertexShader,
      entryPoint: "vert_main",
      buffers: [vertexBufferLayout],
    },
    primitive: {
      topology: "line-list",
    },
    fragment: {
      module: fragmentShader,
      entryPoint: "frag_main",
      targets: [
        {
          format: presentationFormat,
        },
      ],
    },
  };
  const pipeline = device.createRenderPipeline(pipelineDesc);

  const uniformBufferSize = 4 * 16; // 4x4 matrix
  const uniformBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const bindGroupDesc: GPUBindGroupDescriptor = {
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uniformBuffer,
        },
      },
    ],
  };
  const uniformBindGroup = device.createBindGroup(bindGroupDesc);

  function createVertexIndexBuffer() {
    const { vertices, indices, numVerticesToDraw } =
      mesh.getMeshData(currSubdiv);
    const vertexData = new Float32Array(vertices);
    const bufferDesc: GPUBufferDescriptor = {
      size: vertexData.byteLength,
      // usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
      mappedAtCreation: true,
    };

    for (let i = 0; i < 2; i += 1) {
      vertexBuffer[i] = device!.createBuffer(bufferDesc);
      new Float32Array(vertexBuffer[i].getMappedRange()).set(vertexData);
      vertexBuffer[i].unmap();
    }

    const indexData = new Uint32Array(indices);
    indexBuffer = device!.createBuffer({
      size: indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device!.queue.writeBuffer(indexBuffer, 0, indexData);

    numToDraw = numVerticesToDraw;

    for (let i = 0; i < 2; i += 1) {
      vertexBindGroup[i] = device!.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: {
              buffer: simParamBuffer,
            },
          },
          {
            binding: 1,
            resource: {
              buffer: vertexBuffer[i],
              offset: 0,
              size: vertexData.byteLength,
            },
          },
          {
            binding: 2,
            resource: {
              buffer: vertexBuffer[1 - i],
              offset: 0,
              size: vertexData.byteLength,
            },
          },
        ],
      });
    }
  }

  function updateSimParams(deltaTime: number) {
    const s = new ArrayBuffer(4 * 4);
    const d = new Float32Array(s);
    d[1] = gravity;
    d[2] = centerOffset;
    d[3] = deltaTime / 1000;
    const d2 = new Uint32Array(s);
    d2[0] = currSubdiv;
    device!.queue.writeBuffer(simParamBuffer, 0, s);
  }

  function renderFrame(timeStamp: number) {
    if (newSubdiv !== currSubdiv) {
      currSubdiv = newSubdiv;
      createVertexIndexBuffer();
    }

    const elapsed = timeStamp - lastFrameTime;
    lastFrameTime = timeStamp;

    updateSimParams(elapsed);

    const transformationMatrix = getTransformationMatrix(
      armLength,
      angleYaw,
      anglePitch,
    );
    device!.queue.writeBuffer(
      uniformBuffer,
      0,
      transformationMatrix.buffer,
      transformationMatrix.byteOffset,
      transformationMatrix.byteLength,
    );

    const renderPassDesc: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: context!.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0.3, g: 0.3, b: 0.3, a: 1.0 },
        },
      ],
    };

    const commandEncoder = device!.createCommandEncoder();
    {
      const passEncoder = commandEncoder.beginComputePass(
        computePassDescriptor,
      );
      passEncoder.setPipeline(computePipeline);
      passEncoder.setBindGroup(0, vertexBindGroup[p]);
      passEncoder.dispatchWorkgroups(Math.ceil(numToDraw / 64));
      passEncoder.end();
    }
    {
      const renderPass = commandEncoder.beginRenderPass(renderPassDesc);
      renderPass.setPipeline(pipeline);
      renderPass.setBindGroup(0, uniformBindGroup);

      renderPass.setVertexBuffer(0, vertexBuffer[1 - p]);
      renderPass.setIndexBuffer(indexBuffer, "uint32");

      renderPass.drawIndexed(numToDraw);
      renderPass.end();
    }

    device!.queue.submit([commandEncoder.finish()]);
    p = 1 - p;
    requestAnimationFrame(renderFrame);
  }

  canvas.addEventListener("mousedown", mousePressed);
  canvas.addEventListener("mouseup", mouseUnpressed);
  canvas.addEventListener("mousemove", mouseMove);
  canvas.addEventListener("wheel", mouseWheel);

  lastFrameTime = document.timeline.currentTime as number;
  requestAnimationFrame(renderFrame);
}

function getTransformationMatrix(
  armLength: number,
  yaw: number,
  pitch: number,
) {
  const aspect = canvas!.width / canvas!.height;
  const projectionMatrix = mat4.perspective(
    (2 * Math.PI) / 6,
    aspect,
    0.001,
    100.0,
  );
  const modelViewProjectionMatrix = mat4.create();
  const viewMatrix = mat4.identity();
  mat4.translate(viewMatrix, vec3.fromValues(0, 0, -1 * armLength), viewMatrix);

  mat4.rotate(viewMatrix, vec3.fromValues(-1, 0, 0), pitch, viewMatrix);
  mat4.rotate(viewMatrix, vec3.fromValues(0, -1, 0), yaw, viewMatrix);

  mat4.multiply(projectionMatrix, viewMatrix, modelViewProjectionMatrix);

  return modelViewProjectionMatrix as Float32Array;
}

function mousePressed(mouseEvent: MouseEvent) {
  mouseLastX = mouseEvent.clientX;
  mouseLastY = mouseEvent.clientY;
  bMousePressed = true;
}
function mouseUnpressed() {
  bMousePressed = false;
}
function mouseMove(mouseEvent: MouseEvent) {
  if (bMousePressed) {
    anglePitch += 0.007 * (mouseLastY - mouseEvent.clientY);
    angleYaw += 0.007 * (mouseLastX - mouseEvent.clientX);

    anglePitch = Math.min(Math.PI / 2 - 1, anglePitch);
    anglePitch = Math.max(-Math.PI / 2 + 0.1, anglePitch);

    mouseLastX = mouseEvent.clientX;
    mouseLastY = mouseEvent.clientY;
  }
}
function mouseWheel(mouseEvent: WheelEvent) {
  if (mouseEvent.deltaY > 0) {
    armLength *= 1.4;
  } else {
    armLength *= 0.71;
  }
  armLength = Math.max(armLength, 1);
  armLength = Math.min(armLength, 10);
}

function updateSubdiv(subdiv: number) {
  newSubdiv = subdiv;
}
function updateCenterOffset(c: number) {
  centerOffset = c;
}
function toggleGravity() {
  gravity = -9.8 - gravity;
}

export default { init, updateSubdiv, updateCenterOffset, toggleGravity };
