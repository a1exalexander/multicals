import { useLocalSearchParams } from 'expo-router'
import { EventDetails } from '../../components/details/EventDetails'

/** Event details sheet (native formSheet, see _layout.tsx). */
export default function Screen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <EventDetails key={id} id={id} />
}
