import { headline } from '../lib/derive'

export default function Headline({ homes }) {
  return <p className="headline">{headline(homes)}</p>
}
