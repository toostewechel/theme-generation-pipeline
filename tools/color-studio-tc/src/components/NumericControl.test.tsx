// @vitest-environment jsdom
import { act } from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { NumericControl } from "./NumericControl.js";

test("renders name and formatted value label", async () => {
  await act(async () => {
    render(
      <NumericControl name="Hue" min={0} max={360} step={1} value={120} format={(v) => `${v}°`} onValueChange={() => {}} />,
    );
  });
  expect(screen.getByText("Hue")).toBeInTheDocument();
  expect(screen.getByText("120°")).toBeInTheDocument();
});

test("renders help affordance when help prop is provided", async () => {
  await act(async () => {
    render(
      <NumericControl name="Saturation" min={0} max={100} step={1} value={50} onValueChange={() => {}} help="Controls the color saturation" />,
    );
  });
  const helpButton = screen.getByRole("button", { name: /Saturation help/i });
  expect(helpButton).toBeInTheDocument();
});
