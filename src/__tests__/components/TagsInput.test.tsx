import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagsInput } from '#/components/blog/TagsInput'

const suggestions = ['typescript', 'react', 'testing', 'css']

describe('TagsInput', () => {
  it('renders existing tags as removable chips', () => {
    render(<TagsInput value={['react', 'css']} onChange={() => {}} suggestions={[]} />)
    expect(screen.getByText('react')).toBeTruthy()
    expect(screen.getByText('css')).toBeTruthy()
    expect(screen.getByLabelText('Remove react')).toBeTruthy()
    expect(screen.getByLabelText('Remove css')).toBeTruthy()
  })

  it('adds a tag on Enter', async () => {
    const onChange = vi.fn()
    render(<TagsInput value={[]} onChange={onChange} suggestions={suggestions} />)

    const input = screen.getByPlaceholderText('Add tags…')
    await userEvent.type(input, 'newtag{Enter}')
    expect(onChange).toHaveBeenCalledWith(['newtag'])
  })

  it('adds a tag on comma', async () => {
    const onChange = vi.fn()
    render(<TagsInput value={[]} onChange={onChange} suggestions={suggestions} />)

    const input = screen.getByPlaceholderText('Add tags…')
    await userEvent.type(input, 'newtag,')
    expect(onChange).toHaveBeenCalledWith(['newtag'])
  })

  it('does not add duplicate tags', async () => {
    const onChange = vi.fn()
    render(<TagsInput value={['react']} onChange={onChange} suggestions={suggestions} />)

    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'react{Enter}')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('removes a tag when its remove button is clicked', async () => {
    const onChange = vi.fn()
    render(<TagsInput value={['react', 'css']} onChange={onChange} suggestions={suggestions} />)

    await userEvent.click(screen.getByLabelText('Remove react'))
    expect(onChange).toHaveBeenCalledWith(['css'])
  })

  it('removes the last tag on Backspace when input is empty', async () => {
    const onChange = vi.fn()
    render(<TagsInput value={['react', 'css']} onChange={onChange} suggestions={suggestions} />)

    const input = screen.getByRole('textbox')
    await userEvent.click(input)
    await userEvent.keyboard('{Backspace}')
    expect(onChange).toHaveBeenCalledWith(['react'])
  })

  it('shows filtered suggestions when typing', async () => {
    render(<TagsInput value={[]} onChange={() => {}} suggestions={suggestions} />)

    const input = screen.getByPlaceholderText('Add tags…')
    await userEvent.type(input, 'type')
    expect(screen.getByText('typescript')).toBeTruthy()
    expect(screen.queryByText('react')).toBeNull()
  })

  it('excludes already-selected tags from suggestions', async () => {
    render(<TagsInput value={['typescript']} onChange={() => {}} suggestions={suggestions} />)

    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'type')
    // 'typescript' appears as a chip but should NOT appear in the suggestions dropdown
    const matches = screen.getAllByText('typescript')
    expect(matches).toHaveLength(1) // only the chip, not a suggestion
  })
})
