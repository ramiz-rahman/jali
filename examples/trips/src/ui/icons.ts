/** The app's icons for what a place is and how a leg goes, one table each, shared by every list, row and pin. */
import {
  AirplaneTiltIcon,
  BedIcon,
  BoatIcon,
  CarIcon,
  ForkKnifeIcon,
  MopedIcon,
  PersonSimpleWalkIcon,
  StarIcon,
  TrainIcon,
  type Icon,
} from "@phosphor-icons/react";
import { isFerry, type Mode, type ModeOf } from "../trip/modes";
import type { Category } from "../trip/places";

export const CATEGORY_ICON: Record<Category, Icon> = {
  airport: AirplaneTiltIcon,
  sight: StarIcon,
  food: ForkKnifeIcon,
  stay: BedIcon,
};

const MODE_ICON: Record<Mode, Icon> = {
  walk: PersonSimpleWalkIcon,
  transit: TrainIcon,
  taxi: CarIcon,
  scooter: MopedIcon,
  flight: AirplaneTiltIcon,
};

/** A leg's mode as an icon: the river ferry as a boat. */
export const modeIcon = (m: ModeOf): Icon => (isFerry(m) ? BoatIcon : MODE_ICON[m.mode]);
