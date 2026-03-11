import { test as base, expect } from "@playwright/test";
import { test as authTest } from "../fixtures/auth";

base.describe("friends: unauthenticated", () => {
	base("shows sign-in prompt when not authenticated", async ({ page }) => {
		await page.goto("/friends");
		await expect(
			page.getByRole("heading", { name: "Friends" }),
		).toBeVisible();
		await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
	});
});

authTest.describe("friends: authenticated", () => {
	authTest("can add a friend and see them in the list", async ({ page }) => {
		await page.goto("/friends");
		await expect(
			page.getByRole("heading", { name: "Add a friend" }),
		).toBeVisible();

		// Fill out the add friend form
		await page.getByPlaceholder("Alice").fill("E2E Test Friend");
		await page.getByRole("button", { name: "Add" }).click();

		// Friend should appear in the All friends table
		await expect(page.getByText("E2E Test Friend")).toBeVisible();
	});

	authTest(
		"can mark a friend as contacted and delete them",
		async ({ page }) => {
			await page.goto("/friends");

			// Add a daily-frequency friend so they're immediately due
			await page.getByPlaceholder("Alice").fill("E2E Daily Friend");
			const frequencySelect = page.locator("select").filter({ has: page.locator('option[value="1"]') }).first();
			await frequencySelect.selectOption("1");
			await page.getByRole("button", { name: "Add" }).click();

			// Wait for the friend to appear
			await expect(page.getByText("E2E Daily Friend")).toBeVisible();

			// The friend should be in the table — find the row and delete
			const row = page.locator("tr").filter({ hasText: "E2E Daily Friend" });
			await row.getByRole("button", { name: "Delete" }).click();

			// Friend should be removed
			await expect(page.getByText("E2E Daily Friend")).not.toBeVisible();
		},
	);

	authTest("can edit a friend", async ({ page }) => {
		await page.goto("/friends");

		// Add a friend first
		await page.getByPlaceholder("Alice").fill("E2E Edit Friend");
		await page.getByRole("button", { name: "Add" }).click();
		await expect(page.getByText("E2E Edit Friend")).toBeVisible();

		// Click Edit on the friend's row
		const row = page.locator("tr").filter({ hasText: "E2E Edit Friend" });
		await row.getByRole("button", { name: "Edit" }).click();

		// Edit the name in the inline form
		const nameInput = row.locator('input[type="text"]').first();
		await nameInput.clear();
		await nameInput.fill("E2E Edited Friend");
		await row.getByRole("button", { name: "Save" }).click();

		// Verify the name changed
		await expect(page.getByText("E2E Edited Friend")).toBeVisible();
		await expect(page.getByText("E2E Edit Friend")).not.toBeVisible();

		// Clean up: delete the friend
		const editedRow = page
			.locator("tr")
			.filter({ hasText: "E2E Edited Friend" });
		await editedRow.getByRole("button", { name: "Delete" }).click();
		await expect(page.getByText("E2E Edited Friend")).not.toBeVisible();
	});
});
