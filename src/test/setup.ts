import "@testing-library/jest-dom";
import "vitest-axe/extend-expect";
import { expect } from "vitest";
import * as matchers from "vitest-axe/matchers";

expect.extend(matchers);

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
