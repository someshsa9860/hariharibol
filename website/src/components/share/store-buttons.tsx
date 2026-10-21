import { Icon } from '@/components/ui/icon';

/**
 * The two store buttons. A button appears only for a store whose listing is configured — an unconfigured one is
 * left out rather than pointing somewhere invented. (These are plain buttons, not the official badge artwork; drop
 * the stores' own badge files in if brand rules require them.)
 */
export function StoreButtons({ stores }: { stores: { play: string | null; appStore: string | null } }) {
  if (!stores.play && !stores.appStore) return null;
  return (
    <div className="store-row">
      {stores.play && (
        <a className="store-btn" href={stores.play} rel="noopener">
          <Icon name="play" size={22} />
          <span><small>Get it on</small>Google Play</span>
        </a>
      )}
      {stores.appStore && (
        <a className="store-btn" href={stores.appStore} rel="noopener">
          <Icon name="apple" size={22} />
          <span><small>Download on the</small>App Store</span>
        </a>
      )}
    </div>
  );
}
