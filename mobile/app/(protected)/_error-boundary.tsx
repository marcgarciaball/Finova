import { Component, type ReactNode } from 'react'
import { Button, Text, View } from 'react-native'
import { reportError } from '../../src/lib/log-error'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    reportError(error)
  }

  render() {
    if (this.state.error) {
      return (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <Text>Something went wrong.</Text>
          <Button
            title="Try again"
            onPress={() => this.setState({ error: null })}
          />
        </View>
      )
    }
    return this.props.children
  }
}
