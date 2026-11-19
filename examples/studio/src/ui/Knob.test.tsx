import { describe, expect, it, vi } from "vite-plus/test";
import { fireEvent, render, screen } from "@testing-library/react";
import { Jog, Knob } from "./Knob";

describe("the rotary controls are real sliders", () => {
  it("a knob has a role, a name and a value, and turns with the keys", () => {
    const onChange = vi.fn();
    render(
      <Knob
        label="Pan for Mic A"
        value={0}
        min={-100}
        max={100}
        step={1}
        reset={0}
        valueText="centre"
        onChange={onChange}
      />,
    );
    const knob = screen.getByRole("slider", { name: "Pan for Mic A" });
    expect(knob.getAttribute("aria-valuenow")).toBe("0");
    expect(knob.getAttribute("aria-valuetext")).toBe("centre");
    expect(knob.tabIndex).toBe(0);
    fireEvent.keyDown(knob, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith(1);
    fireEvent.keyDown(knob, { key: "ArrowDown", shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(-10);
    fireEvent.keyDown(knob, { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith(100);
    fireEvent.doubleClick(knob);
    expect(onChange).toHaveBeenLastCalledWith(0);
    // A key it doesn't use is left to bubble: Space still reaches the transport.
    const space = fireEvent.keyDown(knob, { key: " " });
    expect(space).toBe(true);
  });

  it("the jog wheel scrubs with the arrow keys and stays in range", () => {
    const onChange = vi.fn();
    render(
      <Jog
        label="Scrub"
        value={2}
        min={0}
        max={70}
        step={1}
        degreesPerUnit={24}
        onChange={onChange}
      />,
    );
    const jog = screen.getByRole("slider", { name: "Scrub" });
    fireEvent.keyDown(jog, { key: "ArrowLeft", shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(jog, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith(3);
  });
});
