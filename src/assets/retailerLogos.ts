/**
 * Chain logos.
 *
 * The files in `assets/logos/` are **placeholders** (a coloured badge with the
 * chain's initials) so the app builds and looks complete out of the box.
 *
 * To ship the real thing, overwrite the PNGs with the official artwork from
 * each chain's press kit — same file names, same square format, transparent
 * background, ~240 × 240 px. No code change is needed. Logos are trademarks of
 * their owners; they may be used to identify the shop the offer belongs to, but
 * they must not be altered, recoloured or used as the app's own branding, and
 * whether they may be redistributed in a public repository depends on each
 * chain's brand guidelines.
 */
import type { ImageSourcePropType } from 'react-native';

const logos: Record<string, ImageSourcePropType> = {
  spar: require('../../assets/logos/spar.png'),
  billa: require('../../assets/logos/billa.png'),
  billaplus: require('../../assets/logos/billaplus.png'),
  hofer: require('../../assets/logos/hofer.png'),
  lidl: require('../../assets/logos/lidl.png'),
  penny: require('../../assets/logos/penny.png'),
};

/** Bundled logo for a chain, or `undefined` when we have none (initials fallback). */
export const getRetailerLogo = (retailerId: string): ImageSourcePropType | undefined =>
  logos[retailerId];
