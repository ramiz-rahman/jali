import { describe, expect, it, vi } from "vite-plus/test";
import { fireEvent, render, screen } from "@testing-library/react";
import { JogDial } from "./dial/JogDial";
import { PanDial } from "./dial/PanDial";
import { SelectorDial } from "./dial/SelectorDial";
import { dbToFader, Fader, faderToDb, settle } from "./Fader";

describe("the rotary controls are real sliders", () => {
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
    render(<JogDial label="Scrub" value={20} min={0} max={70} perTurn={10} onChange={onChange} />);
    const dial = screen.getByRole("slider", { name: "Scrub" });
    box(dial.querySelector(".dial-body")!);
    // From 12 o'clock, a quarter turn at a time, all the way round.
    fireEvent.pointerDown(dial, { button: 0, clientX: 50, clientY: 0, pointerId: 1 });
    expect(dial.hasAttribute("data-dragging")).toBe(true);
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
    expect(dial.hasAttribute("data-dragging")).toBe(false);
    // The hand is off: a move turns nothing.
    fireEvent.pointerMove(dial, { clientX: 100, clientY: 50, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(27.5);
  });

  it("the jog dial steps with the keys and the mouse wheel, and stays in range", () => {
    const onChange = vi.fn();
    render(<JogDial label="Scrub" value={20} min={0} max={70} perTurn={10} onChange={onChange} />);
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

const square = (el: Element, size = 100) => {
  (el as HTMLElement).getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: size,
      height: size,
      right: size,
      bottom: size,
      x: 0,
      y: 0,
      toJSON() {},
    }) as DOMRect;
};

describe("the pan dial", () => {
  it("turns round its centre: 270° is the full range, with a detent at C", () => {
    const onChange = vi.fn();
    render(<PanDial label="Pan" value={0} onChange={onChange} />);
    const dial = screen.getByRole("slider", { name: "Pan" });
    square(dial.querySelector(".dial-body")!);
    fireEvent.pointerDown(dial, { button: 0, clientX: 50, clientY: 0, pointerId: 1 });
    // A quarter turn clockwise: 90/270 of 200 is 67.
    fireEvent.pointerMove(dial, { clientX: 100, clientY: 50, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(67);
    fireEvent.pointerUp(dial, { pointerId: 1 });
  });

  it("settles into C when close, unless Shift is held; double-click centres it", () => {
    const onChange = vi.fn();
    render(<PanDial label="Pan" value={10} onChange={onChange} />);
    const dial = screen.getByRole("slider", { name: "Pan" });
    square(dial.querySelector(".dial-body")!);
    // From 12 o'clock, about 10° anticlockwise: 10 - 7 = 3, inside the detent.
    fireEvent.pointerDown(dial, { button: 0, clientX: 50, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(dial, { clientX: 41.3, clientY: 0.8, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(0);
    fireEvent.pointerUp(dial, { pointerId: 1 });
    fireEvent.doubleClick(dial);
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it("steps with the keys and the wheel", () => {
    const onChange = vi.fn();
    render(<PanDial label="Pan" value={20} onChange={onChange} />);
    const dial = screen.getByRole("slider", { name: "Pan" });
    fireEvent.keyDown(dial, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith(21);
    fireEvent.keyDown(dial, { key: "ArrowLeft", shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(10);
    fireEvent.keyDown(dial, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith(-100);
    fireEvent.wheel(dial, { deltaY: -100 });
    expect(onChange).toHaveBeenLastCalledWith(25);
  });
});

describe("the fader", () => {
  it("has a taper with 0 dB three quarters up and −6 dB at the middle", () => {
    expect(dbToFader(6)).toBeCloseTo(1);
    expect(dbToFader(0)).toBeCloseTo(0.708, 2);
    expect(dbToFader(-6)).toBeCloseTo(0.5, 2);
    expect(faderToDb(dbToFader(-12))).toBeCloseTo(-12);
    expect(faderToDb(0)).toBe(-60);
  });

  it("settles near 0 dB into its detent, unless fine", () => {
    expect(settle(0.6)).toBe(0);
    expect(settle(-0.7)).toBe(0);
    expect(settle(0.6, true)).toBe(0.6);
    expect(settle(-61)).toBe(-60);
    expect(settle(9)).toBe(6);
  });

  const setup = (value = -6) => {
    const onChange = vi.fn();
    render(<Fader label="Level" value={value} onChange={onChange} />);
    const fader = screen.getByRole("slider", { name: "Level" });
    const travel = fader.querySelector(".fader-travel")!;
    (travel as HTMLElement).getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 30,
        height: 200,
        right: 30,
        bottom: 200,
        x: 0,
        y: 0,
        toJSON() {},
      }) as DOMRect;
    return { fader, onChange };
  };

  it("grabbing the cap never jumps it; dragging moves it relative, finely with Shift", () => {
    const { fader, onChange } = setup(-6);
    const cap = fader.querySelector(".fader-cap")!;
    // At −6 dB the cap sits at the middle (y 100). Grab it a little off-centre: no change.
    fireEvent.pointerDown(cap, { button: 0, clientY: 110, pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
    // 20px up is a tenth of the travel, from where the cap was.
    const at = dbToFader(-6);
    const db = (p: number) => Math.round(faderToDb(p) * 10) / 10;
    fireEvent.pointerMove(cap, { clientY: 90, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(db(at + 0.1));
    // With Shift, 20px more is a quarter as far.
    fireEvent.pointerMove(cap, { clientY: 70, shiftKey: true, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(db(at + 0.125));
    fireEvent.pointerUp(cap, { pointerId: 1 });
  });

  it("pressing the slot moves the cap there; double-click resets to 0 dB", () => {
    const { fader, onChange } = setup(-6);
    fireEvent.pointerDown(fader.querySelector(".fader-groove")!, {
      button: 0,
      clientY: 150,
      pointerId: 1,
    });
    expect(onChange).toHaveBeenLastCalledWith(Math.round(faderToDb(0.25) * 10) / 10);
    fireEvent.pointerUp(fader, { pointerId: 1 });
    fireEvent.doubleClick(fader);
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it("steps with the keys and the wheel", () => {
    const { fader, onChange } = setup(-6);
    fireEvent.keyDown(fader, { key: "ArrowUp" });
    expect(onChange).toHaveBeenLastCalledWith(-5.5);
    fireEvent.keyDown(fader, { key: "ArrowDown", shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(-6.1);
    fireEvent.keyDown(fader, { key: "PageUp" });
    expect(onChange).toHaveBeenLastCalledWith(-3);
    fireEvent.keyDown(fader, { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith(6);
    fireEvent.keyDown(fader, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith(-60);
    fireEvent.wheel(fader, { deltaY: -100 });
    expect(onChange).toHaveBeenLastCalledWith(-5.5);
    expect(fader.getAttribute("aria-orientation")).toBe("vertical");
  });
});
