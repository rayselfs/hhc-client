import { Link } from 'react-router-dom'

export default function BiblePage(): React.JSX.Element {
  return (
    <div data-testid="bible-page">
      <h1>Bible</h1>
      <p>Bible page placeholder</p>
      <nav>
        <Link to="/timer">Timer</Link>
      </nav>
    </div>
  )
}
