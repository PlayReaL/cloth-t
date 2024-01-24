struct Params {
  subdiv: u32,
  gravity: f32,
  centerOffset: f32,
  deltaTime: f32,
}
@binding(0) @group(0) var<uniform> params : Params;
@binding(1) @group(0) var<storage, read> bufferA : array<f32>;
@binding(2) @group(0) var<storage, read_write> bufferB : array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) GlobalInvocationID: vec3<u32>) {
    var idx = GlobalInvocationID.x;
    var idxMax = (params.subdiv + 1) * (params.subdiv + 1) - 1;

    if (idx == 0 || idx == params.subdiv || idx == idxMax || idx == idxMax - params.subdiv) {
        var yIndex = idx * 8 + 1;
        return;
    }

    var halfSubdiv = params.subdiv / 2;
    var idxCenter = getIdxFromRC(halfSubdiv, halfSubdiv);
    var coordIdx = idx * 8;

    // store prev pos
    bufferB[coordIdx + 4] = bufferA[coordIdx];
    bufferB[coordIdx + 5] = bufferA[coordIdx + 1];
    bufferB[coordIdx + 6] = bufferA[coordIdx + 2];
    bufferB[coordIdx + 7] = bufferA[coordIdx + 3];

    if (idx == idxCenter) {
        bufferB[coordIdx + 1] = params.centerOffset;
        return;
    }

    var idxR: u32 = idx / (params.subdiv + 1);
    var idxC: u32 = idx % (params.subdiv + 1);
    var damping: f32 = 0.98;
    //magic number
    var gravScale: f32 = (f32(params.subdiv + 9150) / f32(params.subdiv - 21)) / 20000;
    if (params.subdiv < 30) {
        gravScale = 0.1;
    }

    gravScale *= .1;


    var accel: vec3<f32> = getAccelFromNeighbors(idxR, idxC);
    accel.y += params.gravity * gravScale;
    var curPos: vec3<f32> = vec3(bufferA[coordIdx], bufferA[coordIdx + 1], bufferA[coordIdx + 2]);
    var prevPos: vec3<f32> = vec3(bufferA[coordIdx + 4], bufferA[coordIdx + 5], bufferA[coordIdx + 6]);
    // var newPos: vec3<f32> = 2 * curPos - prevPos + params.deltaTime * params.deltaTime * accel;
    var newPos: vec3<f32> = curPos + (curPos - prevPos) * damping + params.deltaTime * params.deltaTime * accel;
    bufferB[coordIdx] = newPos.x;
    bufferB[coordIdx + 1] = newPos.y;
    bufferB[coordIdx + 2] = newPos.z;
    bufferB[coordIdx + 3] = 1;
}

fn getIdxFromRC(r: u32, c: u32) -> u32 {
    return r * (params.subdiv + 1) + c;
}

fn getAccelFromNeighbors(r: u32, c: u32) -> vec3<f32> {
    var multiplier: f32 = 70;
    var scaleClamp: f32 = 4;
    var defaultLen: f32 = 2 / f32(params.subdiv);
    var res: vec3<f32> = vec3(0, 0, 0);
    var curIdx: u32 = getIdxFromRC(r, c) * 8;
    var tempIdx: u32 = 0;
    var curPos: vec3<f32> = vec3(bufferA[curIdx], bufferA[curIdx + 1], bufferA[curIdx + 2]);
    var tempPos: vec3<f32> = vec3(0, 0, 0);
    var tempDir: vec3<f32> = vec3(0, 0, 0);
    var tempLen: f32 = 0;
    var tempScale: f32 = 0;

    var idxOffsetArr = array<vec2<u32>, 8>(
        vec2(0, 0),
        vec2(0, 1),
        vec2(0, 2),
        vec2(1, 0),
        vec2(1, 2),
        vec2(2, 0),
        vec2(2, 1),
        vec2(2, 2)

        // vec2(0, 1),
        // vec2(1, 0),
        // vec2(1, 2),
        // vec2(2, 1),
    );

    for (var i = 0u; i < 8; i++) {
        var tempR = r + idxOffsetArr[i].x - 1;
        var tempC = c + idxOffsetArr[i].y - 1;
        if (tempR < 0 || tempR > params.subdiv || tempC < 0 || tempC > params.subdiv) {
            continue;
        }
        tempIdx = getIdxFromRC(tempR, tempC) * 8;
        tempPos = vec3(bufferA[tempIdx], bufferA[tempIdx + 1], bufferA[tempIdx + 2]);
        tempDir = tempPos - curPos;
        tempLen = length(tempDir);
        tempScale = tempLen / defaultLen;
        if (i == 0 || i == 2 || i == 5 || i == 7) {
            tempScale /= 1.414; // sqrt(2)
        }
        if(tempScale > 1) {
            if (tempScale > 1.5) {
                res = res + tempDir * min(pow(tempScale, 4), 70);
            } else {
            // tempScale = min(tempScale, scaleClamp);
                res = res + tempDir * tempScale * 1.5;
            // res = res + tempDir * pow(tempScale, 3);
            }
        } else {
            res = res - tempDir / tempScale * 1.5;
        }
    }
    return res;
}
