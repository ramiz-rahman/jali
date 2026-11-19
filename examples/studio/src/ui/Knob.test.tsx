import { describe, expect, it, vi } from "vite-plus/test";
import { fireEvent, render, screen } from "@testing-library/react";
import { JogDial, Knob, SelectorDial } from "./Knob";

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

  const box = (el: Element) => {
    (el as HTMLElement).getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON() {},
      }) as DOMRect;
  };

  it("the jog dial follows the pointer round its centre: one full turn is ten seconds", () => {
    const onChange = vi.fn();
    const onStart = vi.fn();
    const onEnd = vi.fn();
    render(
      <JogDial
        label="Scrub"
        value={20}
        min={0}
        max={70}
        secondsPerTurn={10}
        onChange={onChange}
        onStart={onStart}
        onEnd={onEnd}
      />,
    );
    const dial = screen.getByRole("slider", { name: "Scrub" });
    box(dial.querySelector(".dial-body")!);
    // From 12 o'clock, a quarter turn at a time, all the way round.
    fireEvent.pointerDown(dial, { button: 0, clientX: 50, clientY: 0, pointerId: 1 });
    expect(onStart).toHaveBeenCalledTimes(1);
    fireEvent.pointerMove(dial, { clientX: 100, clientY: 50, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(22.5);
    fireEvent.pointerMove(dial, { clientX: 50, clientY: 100, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(25);
    // Past 6 o'clock: no jump at the ±180° seam.
    fireEvent.pointerMove(dial, { clientX: 0, clientY: 50, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(27.5);
    fireEvent.pointerMove(dial, { clientX: 50, clientY: 0, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(30);
    // Back the other way.
    fireEvent.pointerMove(dial, { clientX: 0, clientY: 50, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(27.5);
    fireEvent.pointerUp(dial, { pointerId: 1 });
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("the jog dial steps with the keys and the mouse wheel, and stays in range", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const onEnd = vi.fn();
    render(<JogDial label="Scrub" value={20} min={0} max={70} onChange={onChange} onEnd={onEnd} />);
    const dial = screen.getByRole("slider", { name: "Scrub" });
    fireEvent.keyDown(dial, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith(21);
    fireEvent.keyDown(dial, { key: "ArrowLeft", shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(15);
    fireEvent.keyDown(dial, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(dial, { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith(70);
    fireEvent.wheel(dial, { deltaY: 300 });
    expect(onChange).toHaveBeenLastCalledWith(23);
    vi.advanceTimersByTime(300);
    expect(onEnd).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe("the speed dial snaps to its detents", () => {
  const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;
  const setup = (value: (typeof SPEEDS)[number] = 1) => {
    const onChange = vi.fn();
    render(
      <SelectorDial
        label="Speed"
        values={SPEEDS}
        value={value}
        reset={1}
        format={(r: number) => `${r}×`}
        onChange={onChange}
      />,
    );
    return { dial: screen.getByRole("slider", { name: "Speed" }), onChange };
  };

  it("names its value and steps with the keys", () => {
    const { dial, onChange } = setup(1);
    expect(dial.getAttribute("aria-valuetext")).toBe("1×");
    expect(dial.getAttribute("aria-valuenow")).toBe("1");
    fireEvent.keyDown(dial, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith(1.25);
    fireEvent.keyDown(dial, { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(dial, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith(0.75);
  });

  it("points where the pointer is and snaps to the nearest detent; a double-click resets to 1×", () => {
    const { dial, onChange } = setup(0.75);
    const body = dial.querySelector(".dial-body")!;
    (body as HTMLElement).getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON() {},
      }) as DOMRect;
    // Detents 60° apart, 1.25× at 12 o'clock.
    fireEvent.pointerDown(dial, { button: 0, clientX: 52, clientY: 0, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(1.25);
    // About 55° clockwise: nearest is the 60° detent, 1.5×.
    fireEvent.pointerMove(dial, { clientX: 91, clientY: 21, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(1.5);
    fireEvent.pointerUp(dial, { pointerId: 1 });
    fireEvent.doubleClick(dial);
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it("steps one detent per wheel notch", () => {
    const { dial, onChange } = setup(1);
    fireEvent.wheel(dial, { deltaY: -100, timeStamp: 1000 });
    expect(onChange).toHaveBeenLastCalledWith(1.25);
  });
});
