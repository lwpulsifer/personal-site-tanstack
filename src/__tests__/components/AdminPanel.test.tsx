import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { MapSubmission } from "#/lib/map-types"

const mockSubmissions: MapSubmission[] = [
	{
		id: "sub-1",
		map_slug: "lions",
		location_id: null,
		proposed_name: "Test Lion",
		proposed_lat: 37.78,
		proposed_lng: -122.42,
		proposed_address: "123 Test St",
		notes: "Spotted near the park",
		submitter_name: "Jane",
		submitter_email: "jane@test.com",
		status: "pending",
		reviewed_at: null,
		reviewed_by: null,
		created_at: "2026-03-15T12:00:00Z",
		photos: [
			{
				id: "photo-1",
				location_id: null,
				submission_id: "sub-1",
				storage_path: "submissions/test.jpg",
				caption: null,
				exif_lat: null,
				exif_lng: null,
				created_at: "2026-03-15T12:00:00Z",
			},
		],
	},
	{
		id: "sub-2",
		map_slug: "lions",
		location_id: null,
		proposed_name: "Another Lion",
		proposed_lat: 37.76,
		proposed_lng: -122.44,
		proposed_address: null,
		notes: null,
		submitter_name: null,
		submitter_email: null,
		status: "pending",
		reviewed_at: null,
		reviewed_by: null,
		created_at: "2026-03-15T13:00:00Z",
		photos: [],
	},
]

vi.mock("#/server/maps", () => ({
	approveSubmission: vi.fn().mockResolvedValue({ ok: true }),
	rejectSubmission: vi.fn().mockResolvedValue({ ok: true }),
	getApprovedLocations: vi.fn(),
	getLocationPhotos: vi.fn(),
	getPendingSubmissions: vi.fn(),
	submitSighting: vi.fn(),
	deleteLocation: vi.fn(),
}))

vi.mock("#/lib/queries", () => ({
	pendingMapSubmissionsQueryOptions: (slug: string) => ({
		queryKey: ["pendingMapSubmissions", slug],
		queryFn: () => Promise.resolve(mockSubmissions),
	}),
	mapLocationsQueryOptions: (slug: string) => ({
		queryKey: ["mapLocations", slug],
		queryFn: () => Promise.resolve([]),
	}),
}))

const { AdminPanel } = await import("#/components/maps/AdminPanel")

function renderWithProvider(ui: React.ReactNode) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	})
	return render(
		<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
	)
}

describe("AdminPanel", () => {
	it("renders pending submissions", async () => {
		renderWithProvider(<AdminPanel mapSlug="lions" />)

		expect(
			await screen.findByText("Pending Submissions (2)"),
		).toBeTruthy()
		expect(screen.getByText("Test Lion")).toBeTruthy()
		expect(screen.getByText("Another Lion")).toBeTruthy()
	})

	it("shows submission details", async () => {
		renderWithProvider(<AdminPanel mapSlug="lions" />)

		await screen.findByText("Test Lion")
		expect(screen.getByText("123 Test St")).toBeTruthy()
		expect(screen.getByText("37.78000, -122.42000")).toBeTruthy()
		expect(screen.getByText("Spotted near the park")).toBeTruthy()
		expect(screen.getByText(/From: Jane/)).toBeTruthy()
	})

	it("calls onSelectSubmission when a submission is clicked", async () => {
		const onSelect = vi.fn()
		renderWithProvider(
			<AdminPanel
				mapSlug="lions"
				onSelectSubmission={onSelect}
			/>,
		)

		const button = await screen.findByText("Test Lion")
		await userEvent.click(button)

		expect(onSelect).toHaveBeenCalledTimes(1)
		expect(onSelect).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "sub-1",
				proposed_name: "Test Lion",
				proposed_lat: 37.78,
				proposed_lng: -122.42,
			}),
		)
	})

	it("highlights the selected submission", async () => {
		const { container } = renderWithProvider(
			<AdminPanel
				mapSlug="lions"
				selectedSubmissionId="sub-1"
			/>,
		)

		await screen.findByText("Test Lion")

		const selectedItem = container.querySelector(
			'div[role="button"][class*="ring-1"]',
		)
		expect(selectedItem).toBeTruthy()
		expect(selectedItem?.textContent).toContain("Test Lion")
	})

	it("approve button does not trigger onSelectSubmission", async () => {
		const onSelect = vi.fn()
		renderWithProvider(
			<AdminPanel
				mapSlug="lions"
				onSelectSubmission={onSelect}
			/>,
		)

		await screen.findByText("Test Lion")
		const approveButtons = screen.getAllByRole("button", {
			name: "Approve",
		})
		await userEvent.click(approveButtons[0])

		expect(onSelect).not.toHaveBeenCalled()
	})

	it("reject button does not trigger onSelectSubmission", async () => {
		const onSelect = vi.fn()
		renderWithProvider(
			<AdminPanel
				mapSlug="lions"
				onSelectSubmission={onSelect}
			/>,
		)

		await screen.findByText("Test Lion")
		const rejectButtons = screen.getAllByRole("button", {
			name: "Reject",
		})
		await userEvent.click(rejectButtons[0])

		expect(onSelect).not.toHaveBeenCalled()
	})
})
