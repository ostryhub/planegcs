// This library provides WebAssembly bindings for the FreeCAD's geometric solver library planegcs.
// Copyright (C) 2026  LTBL contributors

// This library is free software; you can redistribute it and/or
// modify it under the terms of the GNU Lesser General Public
// License as published by the Free Software Foundation; either
// version 2.1 of the License, or (at your option) any later version.

import type { oid } from "../planegcs_dist/id";
import type { SketchBSpline, SketchBezier } from "./sketch_primitive";

export function lower_bezier_to_bspline(bezier: SketchBezier): SketchBSpline {
    const control_points = [...bezier.control_points];
    if (control_points.length < 2) {
        throw new Error(`Bezier ${bezier.id} needs at least two control points`);
    }

    const degree = control_points.length - 1;
    const weights = normalize_bezier_weights(bezier, control_points.length);

    return {
        type: 'bspline',
        id: bezier.id,
        start_id: control_points[0] as oid,
        end_id: control_points[control_points.length - 1] as oid,
        control_points,
        weights,
        knots: [0, 1],
        multiplicities: [degree + 1, degree + 1],
        degree,
        periodic: false,
        mutable_weights: bezier.mutable_weights ?? bezier.weights !== undefined,
        mutable_knots: false,
    };
}

export function validate_bspline_shape(bspline: SketchBSpline): void {
    if (bspline.control_points.length < 2) {
        throw new Error(`B-spline ${bspline.id} needs at least two control points`);
    }
    if (!Number.isInteger(bspline.degree) || bspline.degree < 1) {
        throw new Error(`B-spline ${bspline.id} degree must be a positive integer`);
    }
    if (bspline.weights.length !== bspline.control_points.length) {
        throw new Error(`B-spline ${bspline.id} weights count must match control point count`);
    }
    if (bspline.knots.length !== bspline.multiplicities.length) {
        throw new Error(`B-spline ${bspline.id} knots count must match multiplicity count`);
    }

    for (const weight of bspline.weights) {
        if (!Number.isFinite(weight) || weight <= 0) {
            throw new Error(`B-spline ${bspline.id} weights must be finite positive numbers`);
        }
    }
    for (let index = 0; index < bspline.knots.length; index++) {
        const knot = bspline.knots[index];
        if (!Number.isFinite(knot)) {
            throw new Error(`B-spline ${bspline.id} knots must be finite numbers`);
        }
        if (index > 0 && knot <= (bspline.knots[index - 1] as number)) {
            throw new Error(`B-spline ${bspline.id} knots must be unique and increasing`);
        }
    }
    for (const multiplicity of bspline.multiplicities) {
        if (!Number.isInteger(multiplicity) || multiplicity < 1) {
            throw new Error(`B-spline ${bspline.id} multiplicities must be positive integers`);
        }
    }

    const multiplicity_sum = bspline.multiplicities.reduce((sum, value) => sum + value, 0);
    const expected_non_periodic_poles = multiplicity_sum - bspline.degree - 1;
    if (!bspline.periodic && expected_non_periodic_poles !== bspline.control_points.length) {
        throw new Error(`B-spline ${bspline.id} non-periodic multiplicities do not match control point count`);
    }

    if (bspline.periodic) {
        const periodic_sum = bspline.multiplicities
            .slice(0, Math.max(bspline.multiplicities.length - 1, 0))
            .reduce((sum, value) => sum + value, 0);
        if (periodic_sum !== bspline.control_points.length) {
            throw new Error(`B-spline ${bspline.id} periodic multiplicities do not match control point count`);
        }
    }
}

function normalize_bezier_weights(bezier: SketchBezier, control_point_count: number): number[] {
    if (bezier.weights === undefined) {
        return Array.from({ length: control_point_count }, () => 1);
    }
    if (bezier.weights.length !== control_point_count) {
        throw new Error(`Bezier ${bezier.id} weights count must match control point count`);
    }
    for (const weight of bezier.weights) {
        if (!Number.isFinite(weight) || weight <= 0) {
            throw new Error(`Bezier ${bezier.id} weights must be finite positive numbers`);
        }
    }
    return [...bezier.weights];
}
