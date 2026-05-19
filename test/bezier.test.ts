// This library provides WebAssembly bindings for the FreeCAD's geometric solver library planegcs.
// Copyright (C) 2026  LTBL contributors

// This library is free software; you can redistribute it and/or
// modify it under the terms of the GNU Lesser General Public
// License as published by the Free Software Foundation; either
// version 2.1 of the License, or (at your option) any later version.

import { describe, expect, it } from 'vitest';
import { lower_bezier_to_bspline, validate_bspline_shape } from '../sketch/bezier';

describe('Bezier lowering', () => {
    it('lowers a cubic Bezier to the FreeCAD-compatible B-spline representation', () => {
        const lowered = lower_bezier_to_bspline({
            type: 'bezier',
            id: 'b1',
            control_points: ['p0', 'p1', 'p2', 'p3'],
        });

        expect(lowered).toEqual({
            type: 'bspline',
            id: 'b1',
            start_id: 'p0',
            end_id: 'p3',
            control_points: ['p0', 'p1', 'p2', 'p3'],
            weights: [1, 1, 1, 1],
            knots: [0, 1],
            multiplicities: [4, 4],
            degree: 3,
            periodic: false,
            mutable_weights: false,
            mutable_knots: false,
        });
    });

    it('preserves explicit rational weights as mutable solver weights', () => {
        const lowered = lower_bezier_to_bspline({
            type: 'bezier',
            id: 'b1',
            control_points: ['p0', 'p1', 'p2'],
            weights: [1, 0.5, 1],
        });

        expect(lowered.weights).toEqual([1, 0.5, 1]);
        expect(lowered.mutable_weights).toBe(true);
        expect(lowered.degree).toBe(2);
        expect(lowered.multiplicities).toEqual([3, 3]);
    });

    it('rejects non-FreeCAD knot and multiplicity shapes', () => {
        expect(() => validate_bspline_shape({
            type: 'bspline',
            id: 'bad',
            start_id: 'p0',
            end_id: 'p3',
            control_points: ['p0', 'p1', 'p2', 'p3'],
            weights: [1, 1, 1, 1],
            knots: [0, 0, 1],
            multiplicities: [4, 1, 4],
            degree: 3,
            periodic: false,
        })).toThrow(/knots must be unique and increasing/);
    });
});
