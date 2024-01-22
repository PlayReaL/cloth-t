import { useState } from "react";

import Frame from "./Frame";
import Slider from "./Slider";

import render from "./render.ts";

let bOffsetAnimated = false;
let interval: number = 0;

function App() {
  const [subdiv, setSubdiv] = useState(10);
  const [centerOffset, setCenterOffset] = useState(0);

  return (
    <>
      <Frame width={1200} height={720} subdiv={subdiv} centerOffset={centerOffset} />
      <div className="slider-container">
        <Slider
          id={"subdiv"}
          min={2}
          max={120}
          step={2}
          value={subdiv}
          onChange={setSubdiv}
          label={"Subdivision"}
        />
        <Slider
          id={"center"}
          min={-0.5}
          max={0.5}
          step={0.01}
          value={centerOffset.toFixed(2)}
          onChange={setCenterOffset}
          label={"Center Offset"}
        />
        <button
          onClick={() => {
            if(bOffsetAnimated) {
              clearInterval(interval);
            } else {
              interval = setInterval(
                () => {
                  setCenterOffset((Math.sin(Date.now() / 200) * 0.25));
                },
                1000 / 60,
              )
            }
            bOffsetAnimated = !bOffsetAnimated;
          }}
        >
          Animate Center
        </button>
        <button
          onClick={render.toggleGravity}
        >
          Toggle Gravity
        </button>
      </div>
    </>
  );
}

export default App;
