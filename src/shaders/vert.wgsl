struct Uniforms {
  modelViewProjectionMatrix: mat4x4<f32>,
}
@binding(0) @group(0) var<uniform> uniforms : Uniforms;

@vertex
fn vert_main(
    @builtin(vertex_index) VertexIndex: u32,
    @location(0) position: vec4<f32>
) -> @builtin(position) vec4<f32> {
    // return vec4<f32>(position.xyz, 1.0);
    var pos = array<f32, 4>(
        0.0,
        0.0,
        0.0,
        0.0
    );
    return uniforms.modelViewProjectionMatrix * vec4<f32>(
        position.x,
        position.y + pos[VertexIndex % 4],
        position.z,
        1.0
    );
}
