import { assert, makeSample, SampleInit } from '../../components/SampleLayout';

import spriteWGSL from './sprite.wgsl';
import updateSpritesWGSL from './updateSprites.wgsl';

const init: SampleInit = async ({ canvas, pageState, gui }) => {
  const adapter = await navigator.gpu.requestAdapter();
  assert(adapter, 'requestAdapter returned null');

  const device = await adapter.requestDevice();


  if (!pageState.active) return;
  const context = canvas.getContext('webgpu') as GPUCanvasContext;
  const devicePixelRatio = window.devicePixelRatio;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format: presentationFormat,
    alphaMode: 'premultiplied',
  });

  const spriteShaderModule = device.createShaderModule({ code: spriteWGSL });
  const renderPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: spriteShaderModule,
      entryPoint: 'vert_main',
      buffers: [
        {
          // instanced particles buffer
          arrayStride: 4 * 4,
          stepMode: 'instance',
          attributes: [
            {
              // instance position
              shaderLocation: 0,
              offset: 0,
              format: 'float32x2',
            },
            {
              // instance velocity
              shaderLocation: 1,
              offset: 2 * 4,
              format: 'float32x2',
            },
          ],
        },
        {
          // vertex buffer
          arrayStride: 2 * 4,
          stepMode: 'vertex',
          attributes: [
            {
              // vertex positions
              shaderLocation: 2,
              offset: 0,
              format: 'float32x2',
            },
          ],
        },
      ],
    },
    fragment: {
      module: spriteShaderModule,
      entryPoint: 'frag_main',
      targets: [
        {
          format: presentationFormat,
        },
      ],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });

  const computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: device.createShaderModule({
        code: updateSpritesWGSL,
      }),
      entryPoint: 'main',
    },
  });

  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [
      {
        view: undefined as GPUTextureView, // Assigned later
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        loadOp: 'clear' as const,
        storeOp: 'store' as const,
      },
    ],
  };

  const computePassDescriptor: GPUComputePassDescriptor = {};

  // prettier-ignore
  const vertexBufferData = new Float32Array([
    -0.01, -0.02, 0.01,
    -0.02, 0.0, 0.02,
  ]);

  const spriteVertexBuffer = device.createBuffer({
    size: vertexBufferData.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(spriteVertexBuffer.getMappedRange()).set(vertexBufferData);
  spriteVertexBuffer.unmap();

  const numParticles = 1500;
  const initialParticleData = new Float32Array(numParticles * 4);
  for (let i = 0; i < numParticles; ++i) {
    initialParticleData[4 * i + 0] = 2 * (Math.random() - 0.5);
    initialParticleData[4 * i + 1] = 2 * (Math.random() - 0.5);
    initialParticleData[4 * i + 2] = 2 * (Math.random() - 0.5) * 0.1;
    initialParticleData[4 * i + 3] = 2 * (Math.random() - 0.5) * 0.1;
  }

  const particleBuffers: GPUBuffer[] = new Array(2);
  const particleBindGroups: GPUBindGroup[] = new Array(2);
  for (let i = 0; i < 2; ++i) {
    particleBuffers[i] = device.createBuffer({
      size: initialParticleData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
      mappedAtCreation: true,
    });
    new Float32Array(particleBuffers[i].getMappedRange()).set(
      initialParticleData
    );
    particleBuffers[i].unmap();
  }

  
  for (let i = 0; i < 2; ++i) {
    particleBindGroups[i] = device.createBindGroup({
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
            buffer: particleBuffers[i],
            offset: 0,
            size: initialParticleData.byteLength,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: particleBuffers[(i + 1) % 2],
            offset: 0,
            size: initialParticleData.byteLength,
          },
        },
      ],
    });
  }

  let t = 0;
  function frame() {
    // Sample is no longer the active page.
    if (!pageState.active) return;

    renderPassDescriptor.colorAttachments[0].view = context
      .getCurrentTexture()
      .createView();

    const commandEncoder = device.createCommandEncoder();
    {
      const passEncoder = commandEncoder.beginComputePass(
        computePassDescriptor
      );
      passEncoder.setPipeline(computePipeline);
      passEncoder.setBindGroup(0, particleBindGroups[t % 2]);
      passEncoder.dispatchWorkgroups(Math.ceil(numParticles / 64));
      passEncoder.end();
    }
    {
      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.setPipeline(renderPipeline);
      passEncoder.setVertexBuffer(0, particleBuffers[(t + 1) % 2]);
      passEncoder.setVertexBuffer(1, spriteVertexBuffer);
      passEncoder.draw(3, numParticles, 0, 0);
      passEncoder.end();
    }

    device.queue.submit([commandEncoder.finish()]);

    ++t;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
};
