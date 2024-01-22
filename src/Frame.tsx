import { useEffect, useRef } from "react";
import render from "./render.ts";

function Frame(props: {
  width: number;
  height: number;
  subdiv: number;
  centerOffset: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    render.init(canvasRef, props);
  }, []);

  useEffect(() => render.updateSubdiv(props.subdiv), [props.subdiv]);
  useEffect(
    () => render.updateCenterOffset(props.centerOffset),
    [props.centerOffset],
  );

  // render.toggleGravity();

  return (
    <>
      <canvas ref={canvasRef} />
    </>
  );
}

export default Frame;
