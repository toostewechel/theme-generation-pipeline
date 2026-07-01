// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { NumericControl } from "./NumericControl.js";

test("renders name and formatted value label", () => {
  render(
    <NumericControl name="Hue" min={0} max={360} step={1} value={120} format={(v) => `${v}°`} onValueChange={() => {}} />,
  );
  expect(screen.getByText("Hue")).toBeInTheDocument();
  expect(screen.getByText("120°")).toBeInTheDocument();
});
