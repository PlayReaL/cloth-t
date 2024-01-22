function getMeshData(sideSubdivision: number) {
  const vertices = [];
  const indices = [];

  const offset = 2 / sideSubdivision;

  let xOffset = -1;
  let zOffset = -1;

  for (let j = 0; j < sideSubdivision + 1; j += 1) {
    xOffset = -1;
    for (let i = 0; i < sideSubdivision + 1; i += 1) {
      vertices.push(xOffset, 0, zOffset, 1);
      vertices.push(xOffset, 0, zOffset, 1);
      xOffset += offset;
    }
    zOffset += offset;
  }

  for (let j = 0; j < sideSubdivision + 1; j += 1) {
    for (let i = 0; i < sideSubdivision; i += 1) {
      const i1 = i + j * (sideSubdivision + 1);
      indices.push(i1, i1 + 1);
    }
  }

  for (let i = 0; i < sideSubdivision + 1; i += 1) {
    for (let j = 0; j < sideSubdivision; j += 1) {
      const i1 = i + j * (sideSubdivision + 1);
      indices.push(i1, i1 + sideSubdivision + 1);
    }
  }

  return {
    vertices,
    indices,
    numVerticesToDraw: indices.length,
  };
}

export default { getMeshData };
