import { useContext, useEffect, useRef, type ComponentProps } from 'react'
import { OverlayTriggerStateContext } from 'react-aria-components'
import { mergeRefs } from '@react-aria/utils'
import { Dropdown as BaseDropdown } from '@heroui/react/dropdown'
import { Popover as BasePopover } from '@heroui/react/popover'

type OpenMenu = { element: HTMLElement; close: () => void }
const openMenus = new Set<OpenMenu>()

function dismissOutsideMenu(event: MouseEvent): void {
  const menus = [...openMenus].filter((menu) => menu.element.isConnected)
  menus.sort((a, b) =>
    a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  )
  const menu = menus.at(-1)
  if (!menu || !(event.target instanceof Node) || menu.element.contains(event.target)) return
  menu.close()
  if (
    event.target instanceof Element &&
    event.target.closest('input, textarea, [contenteditable="true"]')
  )
    return
  event.preventDefault()
  event.stopImmediatePropagation()
}

function useRightClickDismiss(props: {
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null)
  const state = useContext(OverlayTriggerStateContext)
  const isOpen = props.isOpen ?? state?.isOpen ?? false
  const onOpenChange = props.onOpenChange
  useEffect(() => {
    if (!isOpen || !ref.current) return
    const menu = {
      element: ref.current,
      close: () => (onOpenChange ? onOpenChange(false) : state?.close())
    }
    if (openMenus.size === 0) document.addEventListener('contextmenu', dismissOutsideMenu, true)
    openMenus.add(menu)
    return () => {
      openMenus.delete(menu)
      if (openMenus.size === 0)
        document.removeEventListener('contextmenu', dismissOutsideMenu, true)
    }
  }, [isOpen, onOpenChange, state])
  return ref
}

function DropdownPopover({
  ref: forwardedRef,
  ...props
}: ComponentProps<typeof BaseDropdown.Popover>): React.JSX.Element {
  const ref = useRightClickDismiss({ isOpen: props.isOpen, onOpenChange: props.onOpenChange })
  return <BaseDropdown.Popover {...props} ref={mergeRefs(ref, forwardedRef)} />
}

function PopoverContent({
  ref: forwardedRef,
  ...props
}: ComponentProps<typeof BasePopover.Content>): React.JSX.Element {
  const ref = useRightClickDismiss({ isOpen: props.isOpen, onOpenChange: props.onOpenChange })
  return <BasePopover.Content {...props} ref={mergeRefs(ref, forwardedRef)} />
}

export const Dropdown = Object.assign(
  (props: ComponentProps<typeof BaseDropdown>) => <BaseDropdown {...props} />,
  { ...BaseDropdown, Popover: DropdownPopover }
)

export const Popover = Object.assign(
  (props: ComponentProps<typeof BasePopover>) => <BasePopover {...props} />,
  { ...BasePopover, Content: PopoverContent }
)
