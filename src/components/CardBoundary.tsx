import { Component, type ReactNode } from "react"

import type { Widget } from "~/lib/types"

interface CardBoundaryProps {
  item: Widget
  fallback: ReactNode
  children: ReactNode
}

// One card throwing while it renders must not take the page down with it, which is what an error anywhere under the root does without a boundary: the whole new tab goes blank.
// The boundary tries again whenever its widget changes, so an edit, a sync from another device, or a fix in a later version brings the card back.
export class CardBoundary extends Component<CardBoundaryProps, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidUpdate(previous: CardBoundaryProps) {
    if (this.state.failed && previous.item !== this.props.item) {
      this.setState({ failed: false })
    }
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
