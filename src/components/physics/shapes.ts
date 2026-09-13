/**
 * Static definitions for the floating shapes — colors/sizes/kind, matching
 * the reference sketch (a scatter of solid-colored blobs: circles, rounded
 * rects, a triangle). Positions are assigned at spawn time relative to the
 * terrarium's current bounds, not baked in here.
 */

export type ShapeKind = "circle" | "rect" | "triangle";

export interface ShapeSpec {
  id: string;
  kind: ShapeKind;
  color: string;
  /** Circle: radius. Rect: half-width/half-height define the box. Triangle: circumradius. */
  size: number;
  /** Rect only — the box's other half-extent (size is half-width, this is half-height). */
  size2?: number;
  rotation?: number;
}

export const SHAPES: ShapeSpec[] = [
  { id: "purple-ellipse", kind: "circle", color: "#a855c7", size: 46 },
  { id: "wine-blob", kind: "circle", color: "#4a1220", size: 42 },
  { id: "orchid-rect", kind: "rect", color: "#b355a8", size: 54, size2: 40, rotation: -0.08 },
  { id: "teal-dot", kind: "circle", color: "#0f766e", size: 18 },
  { id: "blue-teal-blob", kind: "circle", color: "#2b7a94", size: 44 },
  { id: "green-triangle", kind: "triangle", color: "#1f6b4a", size: 48, rotation: 0.5 },
  { id: "olive-rect", kind: "rect", color: "#7a6b1f", size: 30, size2: 52, rotation: 0.2 },
];
