// The layout (../[bookId].tsx) renders the book page itself. A layout with
// children only matches its own URL when it has an index child, otherwise
// /books/:id falls through to the 404 catch-all — so this renders nothing.
export default function BookIndex() {
  return null
}
