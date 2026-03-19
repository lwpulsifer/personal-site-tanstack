import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToolbarButton } from '#/components/blog/EditorToolbar'

describe('ToolbarButton', () => {
  it('renders a button with the given label and title', () => {
    render(<ToolbarButton label="B" title="Bold" onAction={() => {}} />)
    const btn = screen.getByTitle('Bold')
    expect(btn).toBeTruthy()
    expect(btn.textContent).toBe('B')
  })

  it('calls onAction on mousedown (not click) to preserve textarea focus', async () => {
    const onAction = vi.fn()
    render(<ToolbarButton label="B" title="Bold" onAction={onAction} />)

    const btn = screen.getByTitle('Bold')
    // mousedown fires onAction and calls preventDefault to keep focus in textarea
    await userEvent.pointer({ target: btn, keys: '[MouseLeft>]' })
    expect(onAction).toHaveBeenCalledOnce()
  })

  it('applies optional labelClass to the span', () => {
    render(<ToolbarButton label="I" title="Italic" labelClass="italic" onAction={() => {}} />)
    const span = screen.getByText('I')
    expect(span.className).toContain('italic')
  })
})
