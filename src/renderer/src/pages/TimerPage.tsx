import { Link } from 'react-router-dom'

export default function TimerPage(): React.JSX.Element {
  return (
    <div data-testid="timer-page">
      <h1>Timer</h1>
      <p>Timer page placeholder</p>
      <nav>
        <Link to="/bible">Bible</Link>
      </nav>
    </div>
  )
}
