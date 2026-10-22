export const TILE_HEIGHTS = [12.05, -0.95, -13.95];
// Convex outline of the supplied tile STL, transformed into scene centimetres.
export const TILE_OUTLINE = [[-10, -10], [-10, 6.1958], [-6.1958, 10], [10, 10], [10, -10]];
export const TILE_THICKNESS = 1;
export const RAIL_HALF_HEIGHT = 1;
// The source artwork and its four mounting holes are diagonal to the tile.
export const ACRYLIC_ANGLE = Math.PI / 4;
export const ACRYLIC_OFFSET = 1.12;
export const ENGRAVING_OPACITY = 0.95;
export const SCINTILLATOR_OPACITY = 0.36;
export const LINER_SIZE = [20, 0.1, 20];
export const RUBBER_FOOT = { topRadius: 1.2, bottomRadius: 0.75, height: 0.6, topY: -17.85 };
export const FLOOR_Y = RUBBER_FOOT.topY - RUBBER_FOOT.height;
export const ACRYLIC_MOUNTS = [[0, -11.16], [11.16, 0], [0, 11.16], [-11.16, 0]];
