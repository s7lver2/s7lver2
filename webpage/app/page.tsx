import OniHome from './oni/OniHome';
import { tanker } from './oni/fonts';
import './oni/oni.css';
import './oni/pc/pc.css';
import './oni/room/room.css';
import './oni/library/library.css';
import './oni/ritual/ritual.css';
import './oni/credits/credits.css';
import './oni/supper/supper.css';

export default function Home() {
  return (
    <div lang="en" className={`${tanker.variable} oni-root`}>
      <OniHome fontFamily={tanker.style.fontFamily} />
    </div>
  );
}
