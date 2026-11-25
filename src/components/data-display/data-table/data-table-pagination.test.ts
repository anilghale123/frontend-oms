import { describe, expect, it } from "vitest";
import { visiblePages } from "./data-table-pagination";

/** The footer shows up to four page numbers, starting one before the current page. */
describe("visiblePages", () => {
	it("starts at the first page", () => {
		expect(visiblePages(0, 20)).toEqual([0, 1, 2, 3]);
		expect(visiblePages(1, 20)).toEqual([0, 1, 2, 3]);
	});

	it("keeps the page before the current one in view", () => {
		expect(visiblePages(5, 20)).toEqual([4, 5, 6, 7]);
	});

	it("slides back so the last page still fills the window", () => {
		expect(visiblePages(19, 20)).toEqual([16, 17, 18, 19]);
	});

	it("shows every page when there are fewer than four", () => {
		expect(visiblePages(0, 2)).toEqual([0, 1]);
		expect(visiblePages(0, 0)).toEqual([]);
	});
});
