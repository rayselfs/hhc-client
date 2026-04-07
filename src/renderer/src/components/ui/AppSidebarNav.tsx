import { useLocation, Link } from 'react-router-dom'

interface NavItem {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}

interface AppSidebarNavProps {
  items: NavItem[]
  className?: string
}

export default function AppSidebarNav({ items, className }: AppSidebarNavProps): React.JSX.Element {
  const location = useLocation()

  const isActive = (item: NavItem): boolean => {
    if (item.to === '/timer') {
      return location.pathname === '/' || location.pathname === '/timer'
    }
    return location.pathname === item.to
  }

  return (
    <nav
      className={`flex flex-col gap-2 rounded-tr-xl rounded-br-xl bg-content1 p-4${className ? ` ${className}` : ''}`}
      style={{ width: 'var(--sidebar-width)' }}
    >
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const active = isActive(item)
          const Icon = item.icon

          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-default-500 hover:bg-default-100 hover:text-default-foreground'}`}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
