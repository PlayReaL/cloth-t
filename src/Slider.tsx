function Slider(props: {
  id: string;
  value: number | string;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  label: string;
}) {
  return (
    <div className="slider">
      <input
        type="range"
        id={props.id}
        name={props.id}
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(+e.target.value)}
      />
      <label htmlFor={props.id}>
        {props.label} {props.value}
      </label>
    </div>
  );
}

export default Slider;
