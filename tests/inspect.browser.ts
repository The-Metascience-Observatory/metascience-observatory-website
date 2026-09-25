import { test, expect } from "@playwright/test";

test("review filter changes charts and rows together, persists in links, and resets", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/birds-eye-reviews/long-covid?who=0&below=1&types=rct,crossover,before_after,case_series,prospective_cohort,retrospective_cohort");
  const filter = page.getByLabel("INSPECT-SR review filter", { exact: true });
  const root = page.getByTestId("treatment-dashboard");
  await expect(root).toHaveAttribute("data-filters-ready", "true");
  await expect(filter).toHaveValue("all");
  const original = Number(await root.getAttribute("data-selected-reports"));
  expect(original).toBeGreaterThan(0);
  const synthesisOption = await filter.locator('option[value="synthesis"]').textContent();
  const expected = Number(synthesisOption!.match(/\((\d+)\)$/)![1]);
  expect(expected).toBeGreaterThan(0);
  expect(expected).toBeLessThan(original);
  await filter.selectOption("synthesis");
  await expect(root).toHaveAttribute("data-selected-reports", String(expected));
  await expect(page.getByText(new RegExp(`^${expected} (?:trials|publications) match$`))).toBeVisible();
  await expect(page.locator('[data-paper-id]:not([data-inspect-disposition="provisional_synthesis"]):not([data-inspect-disposition="synthesis"])')).toHaveCount(0);
  await expect(page).toHaveURL(/inspect=synthesis/);
  await page.reload();
  await expect(filter).toHaveValue("synthesis");
  await expect(root).toHaveAttribute("data-selected-reports", String(expected));
  await page.getByLabel("Journal indexing", { exact: true }).selectOption("yes");
  await expect(page.locator('[data-paper-id]:not([data-medline="yes"])')).toHaveCount(0);
  await expect(filter).toHaveValue("synthesis");
  await page.getByRole("button", { name: "Reset publication filters" }).click();
  await page.getByRole("button", { name: "Reset review filter" }).click();
  await expect(root).toHaveAttribute("data-selected-reports", String(original));
  expect(errors).toEqual([]);
});

test("empty sensitivity sets and held reports remain intelligible on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/birds-eye-reviews/long-covid?inspect=rct_sensitivity");
  const filter = page.getByLabel("INSPECT-SR review filter", { exact: true });
  const root = page.getByTestId("treatment-dashboard");
  await expect(filter).toHaveValue("rct_sensitivity");
  await expect(root).toHaveAttribute("data-selected-reports", "0");
  await expect(page.getByText(/^0 (?:trials|publications) match$/)).toBeVisible();
  await expect(page.getByText(/An empty set means no reports met these requirements/)).toBeVisible();
  await page.screenshot({ path: "/tmp/inspect-filter-mobile.png", fullPage: false });
  await filter.selectOption("held");
  await expect(root).not.toHaveAttribute("data-selected-reports", "0");
  const first = page.getByTestId("inspect-details").first();
  await first.locator("summary").click();
  await expect(first.getByText(/human adjudication pending/)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("confirmed retraction is inspectable but absent from treatment synthesis", async ({ page }) => {
  await page.goto("/birds-eye-reviews/long-covid?inspect=excluded&below=1&types=rct,crossover,before_after,case_series,prospective_cohort,retrospective_cohort,interrupted_time_series,quasi_experimental,cross_sectional,case_control");
  const retracted = page.locator('[data-paper-id="10.1016/j.eclinm.2025.103681"]');
  await expect(retracted).toBeVisible();
  await retracted.locator("summary").click();
  await expect(retracted.getByText(/publisher notice confirmed; excluded/)).toBeVisible();
  await page.getByLabel("INSPECT-SR review filter", { exact: true }).selectOption("synthesis");
  await expect(retracted).toHaveCount(0);
});
