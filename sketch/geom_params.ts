// This library provides WebAssembly bindings for the FreeCAD's geometric solver library planegcs.
// Copyright (C) 2023  Miroslav Šerý, Salusoft89 <miroslav.sery@salusoft89.cz>  
// Copyright (C) 2024  Angelo Bartolome <angelo.m.bartolome@gmail.com>

// This library is free software; you can redistribute it and/or
// modify it under the terms of the GNU Lesser General Public
// License as published by the Free Software Foundation; either
// version 2.1 of the License, or (at your option) any later version.

// This library is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// Lesser General Public License for more details.

// You should have received a copy of the GNU Lesser General Public
// License along with this library; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA

import { SketchGeometry } from "./sketch_primitive.js";
import { Constraint } from "../planegcs_dist/constraints.js";

// Object properties that can be referenced in the constraint primitives, such as:
// {
//    "type": "equal",
//    "param1": "my_sketch_param_width",
//    "param2": {
//        "o_id": 2,
//        "property": "radius"
//    }
// }

export type SketchGeometryProperty =
    | 'x'
    | 'y'
    | 'radius'
    | 'start_angle'
    | 'end_angle'
    | 'radmin'
    // B-spline specific properties
    | 'start_x'
    | 'start_y'
    | 'end_x'
    | 'end_y';
export const property_offsets = {
    point: {
        x: 0,
        y: 1
    },
    circle: {
        radius: 0
    },
    arc: {
        start_angle: 0,
        end_angle: 1,
        radius: 2
    },
    ellipse: {
        radmin: 0,
    },
    arc_of_ellipse: {
        start_angle: 0,
        end_angle: 1,
        radmin: 2
    },
    parabola: {
    },
    arc_of_parabola: {
        start_angle: 0,
        end_angle: 1,
    },
    hyperbola: {
        radmin: 0,
    },
    arc_of_hyperbola: {
        start_angle: 0,
        end_angle: 1,
        radmin: 2
    },
    bspline: {
        // these offsets are relative to the start of the B-spline's parameter
        // block in p_params; control points, weights and knots are pushed
        // first, followed by start/end coordinates
        start_x: 0, // computed dynamically in get_property_offset
        start_y: 1,
        end_x: 2,
        end_y: 3,
    },
    line: {},
} as const;

export default function get_property_offset(
    primitive: SketchGeometry,
    property_key: SketchGeometryProperty
): number {
    if (primitive.type === 'bspline') {
        const base =
            primitive.control_points.length * 2 +
            primitive.weights.length +
            primitive.knots.length;
        switch (property_key) {
            case 'start_x':
                return base + property_offsets.bspline.start_x;
            case 'start_y':
                return base + property_offsets.bspline.start_y;
            case 'end_x':
                return base + property_offsets.bspline.end_x;
            case 'end_y':
                return base + property_offsets.bspline.end_y;
            default:
                throw new Error(`Unknown property ${property_key} for primitive <bspline>`);
        }
    }

    const primitive_offsets: Partial<Record<SketchGeometryProperty, number>> =
        property_offsets[primitive.type];
    if (primitive_offsets) {
        const offset = primitive_offsets[property_key];
        if (offset !== undefined) {
            return offset;
        }
    }
    throw new Error(`Unknown property ${property_key} for primitive <${primitive.type}>`);
}