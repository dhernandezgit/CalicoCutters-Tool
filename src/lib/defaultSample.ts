import raw from "../data/defaultSample.json";
import type { BuildResult, DesignAsset, DesignSettings, DesignShape } from "../types";

const shape = {
  ...(raw.shape as unknown as DesignShape),
  sourceKind: "builtin" as const,
};

const settings = raw.settings as unknown as DesignSettings;
const build = raw.build as unknown as BuildResult;
const color = raw.color;
const id = shape.id;

export const DEFAULT_SAMPLE: {
  asset: DesignAsset;
  build: BuildResult;
  signature: string;
} = {
  asset: {
    id,
    name: shape.name,
    shape,
    settings,
    color,
  },
  build,
  signature: `${shape.id}|${JSON.stringify(settings)}|${color}`,
};
