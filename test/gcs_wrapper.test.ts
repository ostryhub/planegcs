// This library provides WebAssembly bindings for the FreeCAD's geometric solver library planegcs.
// Copyright (C) 2023  Miroslav Šerý, Salusoft89 <miroslav.sery@salusoft89.cz>  

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

import { it, describe, expect, vi, beforeAll, beforeEach } from 'vitest';
import { GcsSystemMock } from "../planegcs_dist/gcs_system_mock";
vi.mock('../planegcs_dist/gcs_system_mock');
import { SketchIndex } from "../sketch/sketch_index";
import { GcsWrapper } from "../sketch/gcs_wrapper";
import { Constraint_Alignment } from "../planegcs_dist/enums";
import type { SketchCircle, SketchPoint, SketchBSpline } from '../sketch/sketch_primitive';
import type { BSpline, Circle } from '../planegcs_dist/gcs_system';
import type { ModuleStatic } from '../planegcs_dist/planegcs';

let gcs_wrapper: GcsWrapper;
let gcs: GcsSystemMock;

class TestIntVector {
    private readonly values: number[] = [];

    get(index: number) {
        return this.values[index] as number;
    }

    size() {
        return this.values.length;
    }

    delete() {
        return;
    }

    push_back(value: number) {
        this.values.push(value);
    }
}

const gcs_module = { IntVector: TestIntVector } as unknown as ModuleStatic;

function make_int_vector(values: number[]) {
    const vector = new TestIntVector();
    for (const value of values) {
        vector.push_back(value);
    }
    return vector;
}

// the prefix 'basic:' makes this test run before the wasm compilation
// in the pipeline process
describe("basic: gcs_wrapper", () => {
    beforeAll(() => {
        gcs = new GcsSystemMock();
        gcs_wrapper = new GcsWrapper(gcs, gcs_module);
    });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetAllMocks();
        gcs_wrapper.p_param_index = new Map();
        gcs_wrapper.sketch_index = new SketchIndex();

        // simulate the behaviour of pushing params
        let arr_params: number[] = [];
        const arr_fixed: boolean[] = [];
        vi.spyOn(gcs, 'push_p_param').mockImplementation((val: number, fixed: boolean) => {
            arr_params.push(val);
            arr_fixed.push(fixed);
            return arr_params.length;
        });
        vi.spyOn(gcs, 'params_size').mockImplementation(() => {
            return arr_params.length;
        })
        vi.spyOn(gcs, 'get_p_param').mockImplementation((i: number) => {
            return arr_params[i];
        });
        vi.spyOn(gcs, 'apply_solution').mockImplementation(() => {
            arr_params = arr_params.map(p => p + 1);
        });
    });

    it("calls gcs when pushing a param", () => {
        gcs_wrapper.push_sketch_param('my_param', 10);
        expect(gcs.push_p_param).toHaveBeenCalledWith(10, true);
        gcs_wrapper.push_sketch_param('my_other_param', 0);
        expect(gcs.push_p_param).toHaveBeenCalledWith(0, true);
        expect(gcs_wrapper.get_sketch_param_value('my_param')).to.equal(10);
        expect(gcs_wrapper.get_sketch_param_value('my_other_param')).to.equal(0);
    });

    it("calls gcs when pushing a point", () => {
        gcs_wrapper.push_primitive({type: 'point', id: '1', x: 3, y: 4, fixed: true});
        expect(gcs.push_p_param).toHaveBeenNthCalledWith(1, 3, true)
        expect(gcs.push_p_param).toHaveBeenNthCalledWith(2, 4, true)
        expect(gcs.push_p_param).toHaveBeenCalledTimes(2);
    });

    it("calls gcs when pushing a line", () => {
        gcs_wrapper.push_primitive({type: 'point', id: '1', x: 0, y: 0, fixed: true});
        gcs_wrapper.push_primitive({type: 'point', id: '2', x: 0, y: 0, fixed: true});
        gcs_wrapper.push_primitive({type: 'line', id: '3', p1_id: '1', p2_id: '2'});
        expect(gcs.push_p_param).toHaveBeenCalledTimes(4);
    });

    it("calls gcs when pushing a circle", () => {
        gcs_wrapper.push_primitive({type: 'point', id: '1', x: 0, y: 0, fixed: true});
        gcs_wrapper.push_primitive({type: 'circle', id: '2', c_id: '1', radius: 3});
        expect(gcs.push_p_param).toHaveBeenNthCalledWith(1, 0, true)
        expect(gcs.push_p_param).toHaveBeenNthCalledWith(2, 0, true)
        expect(gcs.push_p_param).toHaveBeenNthCalledWith(3, 3, false)
        expect(gcs.push_p_param).toHaveBeenCalledTimes(3);
    });

    it("calls gcs when pushing an arc", () => {
        gcs_wrapper.push_primitive({type: 'point', id: '1', x: 0, y: 0, fixed: true});
        gcs_wrapper.push_primitive({type: 'point', id: '2', x: 1, y: 2, fixed: true});
        gcs_wrapper.push_primitive({type: 'point', id: '3', x: 10, y: 10, fixed: true});

        const arc = { delete: vi.fn() };
        vi.spyOn(gcs, 'make_arc').mockReturnValueOnce(arc);

        gcs_wrapper.push_primitive({type: 'arc', id: '4', c_id: '1', start_id: '2', end_id: '3', start_angle: 0, end_angle: 0, radius: 1});

        expect(gcs.push_p_param).toHaveBeenCalledTimes(3 * 2 + 3);
    });

    it("calls gcs when pushing a bspline", () => {
        gcs_wrapper.push_primitive({type: 'point', id: 's', x: 0, y: 0, fixed: true});
        gcs_wrapper.push_primitive({type: 'point', id: 'e', x: 1, y: 1, fixed: true});
        gcs_wrapper.push_primitive({type: 'point', id: 'c1', x: -1, y: 0, fixed: true});
        gcs_wrapper.push_primitive({type: 'point', id: 'c2', x: 2, y: 0, fixed: true});

        gcs_wrapper.push_primitive({
            type: 'bspline',
            id: 'b1',
            start_id: 's',
            end_id: 'e',
            control_points: ['s', 'c1', 'c2', 'e'],
            weights: [1, 1, 1, 1],
            knots: [0, 1],
            multiplicities: [4, 4],
            degree: 3,
            periodic: false,
        });

        // 4 points * 2 params + 4 weights + 2 unique knots
        expect(gcs.push_p_param).toHaveBeenCalledTimes(14);
        expect(gcs.push_p_param).toHaveBeenNthCalledWith(9, 1, false);
        expect(gcs.push_p_param).toHaveBeenNthCalledWith(12, 1, false);
        expect(gcs.push_p_param).toHaveBeenNthCalledWith(13, 0, true);
        expect(gcs.push_p_param).toHaveBeenNthCalledWith(14, 1, true);
    });

    it("lowers Bezier primitives to fixed-knot B-splines", () => {
        gcs_wrapper.push_primitive({type: 'point', id: 'p0', x: 0, y: 0, fixed: true});
        gcs_wrapper.push_primitive({type: 'point', id: 'p1', x: 1, y: 2, fixed: true});
        gcs_wrapper.push_primitive({type: 'point', id: 'p2', x: 3, y: 2, fixed: true});
        gcs_wrapper.push_primitive({type: 'point', id: 'p3', x: 4, y: 0, fixed: true});

        gcs_wrapper.push_primitive({
            type: 'bezier',
            id: 'b1',
            control_points: ['p0', 'p1', 'p2', 'p3'],
        });

        // 4 points * 2 params + 4 default fixed weights + 2 fixed unique knots
        expect(gcs.push_p_param).toHaveBeenCalledTimes(14);
        expect(gcs.push_p_param).toHaveBeenNthCalledWith(9, 1, true);
        expect(gcs.push_p_param).toHaveBeenNthCalledWith(12, 1, true);
        expect(gcs.push_p_param).toHaveBeenNthCalledWith(13, 0, true);
        expect(gcs.push_p_param).toHaveBeenNthCalledWith(14, 1, true);
    });

    it("maps diagnosed DOF parameter indices back to sketch properties", () => {
        gcs_wrapper.push_primitive({type: 'point', id: 'fixed', x: 0, y: 0, fixed: true});
        gcs_wrapper.push_primitive({type: 'point', id: 'free', x: 1, y: 2, fixed: false});
        gcs_wrapper.push_primitive({type: 'circle', id: 'circle', c_id: 'fixed', radius: 3});

        vi.spyOn(gcs, 'diagnose_system').mockReturnValue(2);
        vi.spyOn(gcs, 'get_dependent_param_indices').mockReturnValue(make_int_vector([3, 4, 3]));
        vi.spyOn(gcs, 'get_dependent_param_group_indices').mockReturnValue(make_int_vector([3, -1, 4]));
        vi.spyOn(gcs, 'get_is_fixed').mockImplementation((index: number) => index < 2);

        const report = gcs_wrapper.get_dof_report();

        expect(report.dof).toBe(2);
        expect(report.is_fully_constrained).toBe(false);
        expect(report.free_parameter_indices).toEqual([3, 4]);
        expect(report.dependent_parameter_groups).toEqual([[3], [4]]);
        expect(report.parameters.find((param) => param.index === 3)).toMatchObject({
            oid: 'free',
            entity_type: 'point',
            property: 'y',
            status: 'free',
        });
        expect(report.parameters.find((param) => param.index === 4)).toMatchObject({
            oid: 'circle',
            entity_type: 'circle',
            property: 'radius',
            status: 'free',
        });
        expect(report.parameters.find((param) => param.index === 2)).toMatchObject({
            oid: 'free',
            entity_type: 'point',
            property: 'x',
            status: 'constrained',
        });
    });

    it("calls add_constraint_equal method when adding an equal constraint", () => {
        const o1_p1_addr = gcs.params_size();
        gcs_wrapper.push_primitive({type: 'point', id: '1', x: 0, y: 0, fixed: false});
        expect(gcs.push_p_param).toHaveBeenCalledTimes(2);

        const value_addr = gcs.params_size();
        gcs_wrapper.push_primitive({type: 'equal', id: '2', param1: { o_id: '1', prop: 'x' }, param2: 5});
        expect(gcs.push_p_param).toHaveBeenCalledTimes(3);
        expect(gcs.push_p_param).toHaveBeenLastCalledWith(5, true);

        const tag = 2;
        expect(gcs.add_constraint_equal).toHaveBeenCalledWith(o1_p1_addr, value_addr, tag, true, 0, 1);
    });

    it("calls add_constraint_equal with driving parameter and internal constraint when provided", () => {
        const o1_p1_addr = gcs.params_size();
        gcs_wrapper.push_primitive({type: 'point', id: '1', x: 0, y: 0, fixed: false});
        const value_addr = gcs.params_size();
        gcs_wrapper.push_primitive({type: 'equal', id: '2', param1: { o_id: '1', prop: 'x' }, param2: 5, driving: false, internalalignment: Constraint_Alignment.InternalAlignment});

        const tag = 2; 
        expect(gcs.add_constraint_equal).toHaveBeenCalledWith(o1_p1_addr, value_addr, tag, false, 1, 1);
    });

    it("calls add_constraint_equal with temporary tag -1 and different scale", () => {
        const o1_p1_addr = gcs.params_size();
        gcs_wrapper.push_primitive({type: 'point', id: '1', x: 0, y: 0, fixed: false});
        const value_addr = gcs.params_size();
        const scale = 0.01;
        gcs_wrapper.push_primitive({type: 'equal', id: '2', param1: { o_id: '1', prop: 'x' }, param2: 5, temporary: true, scale});

        const TEMPORARY_TAG = -1;
        expect(gcs.add_constraint_equal).toHaveBeenCalledWith(o1_p1_addr, value_addr, TEMPORARY_TAG, true, 0, scale);
    });

    it("calls add_constraint_angle_via_point when adding a constraint (with shuffled arguments)", () => {
        gcs_wrapper.push_primitive({type: 'point', id: '1', x: 0, y: 0, fixed: false});
        gcs_wrapper.push_primitive({type: 'point', id: '2', x: 1, y: 2, fixed: false});
        gcs_wrapper.push_primitive({type: 'line', id: '3', p1_id: '1', p2_id: '2'});
        gcs_wrapper.push_primitive({type: 'point', id: '4', x: 10, y: 10, fixed: false});
        gcs_wrapper.push_primitive({type: 'arc', id: '5', c_id: '1', start_id: '2', end_id: '4', start_angle: 0, end_angle: 0, radius: 1});
        
        const line = { delete: vi.fn() };
        const point = { delete: vi.fn() };
        const arc = { delete: vi.fn() };

        vi.spyOn(gcs, 'make_line').mockReturnValueOnce(line);
        vi.spyOn(gcs, 'make_point').mockReturnValueOnce(point);
        vi.spyOn(gcs, 'make_arc').mockReturnValueOnce(arc);

        gcs_wrapper.push_primitive({
            id: '6',
            crv1_id: '3', // Line
            angle: Math.PI / 2,
            crv2_id: '5', // Arc
            p_id: '4',
            type: 'angle_via_point'
        });

        expect(gcs.make_line).toHaveBeenCalledWith(0, 1, 2, 3);
        expect(gcs.make_arc).toHaveBeenCalledWith(
            // center
            0, 1, 
            // start
            2, 3, 
            // end
            4, 5,
            // start angle, end angle, radius
            6, 7, 8);
        expect(gcs.make_point).toHaveBeenCalledWith(4, 5);

        expect(line.delete).toHaveBeenCalledTimes(0);
        expect(arc.delete).toHaveBeenCalledTimes(0);
        expect(point.delete).toHaveBeenCalledTimes(0);

        gcs_wrapper.clear_data();

        expect(line.delete).toHaveBeenCalledTimes(1);
        expect(arc.delete).toHaveBeenCalledTimes(1);
        expect(point.delete).toHaveBeenCalledTimes(1);
    });

    it('updates the solved_sketch_index after calling solve', () => {
        gcs_wrapper.push_primitive({type: 'point', id: '1', x: 0, y: 0, fixed: false});
        gcs_wrapper.push_primitive({type: 'point', id: '2', x: 1, y: 2, fixed: false});
        gcs_wrapper.push_primitive({type: 'point', id: '5', x: -1, y: 0, fixed: false});
        gcs_wrapper.push_primitive({type: 'point', id: '6', x: 2, y: 0, fixed: false});
        gcs_wrapper.push_primitive({type: 'line', id: '3', p1_id: '1', p2_id: '2'});
        gcs_wrapper.push_primitive({type: 'circle', id: '4', c_id: '1', radius: 3});
        gcs_wrapper.push_primitive({
            type: 'bspline',
            id: 'b1',
            start_id: '1',
            end_id: '2',
            control_points: ['1', '5', '6', '2'],
            weights: [1, 1, 1, 1],
            knots: [0, 1],
            multiplicities: [4, 4],
            degree: 3,
            periodic: false,
        });

        const old_primitivs = gcs_wrapper.sketch_index.get_primitives();
        expect(old_primitivs).toHaveLength(7);

        // does +1 to each parameter
        gcs_wrapper.apply_solution(); 

        for (const item of old_primitivs) {
            const new_primitive = gcs_wrapper.sketch_index.get_primitive_or_fail(item.id);
            if (new_primitive.type !== item.type) {
                expect(new_primitive.type).toEqual(item.type);
            }

            switch(new_primitive.type) {
                case 'point':
                    {
                        const point = item as SketchPoint;
                        expect(new_primitive.x).toBe(point.x + 1)
                        expect(new_primitive.y).toBe(point.y + 1)
                        break;
                    }
                case 'circle':
                    {
                        const circle = item as SketchCircle;
                        expect(new_primitive.radius).toBe(circle.radius + 1)
                        break;
                    }
                case 'bspline':
                    {
                        const bs = item as SketchBSpline;
                        expect(new_primitive.weights[0]).toBe(bs.weights[0] + 1)
                        expect(new_primitive.knots[0]).toBe(bs.knots[0] + 1)
                        break;
                    }
            }
        }
    });

    it("passes B-spline internal alignment indexes as numbers", () => {
        const bspline = { delete: vi.fn() } satisfies BSpline;
        const circle = { delete: vi.fn() } satisfies Circle;

        vi.spyOn(gcs, 'make_bspline').mockReturnValue(bspline);
        vi.spyOn(gcs, 'make_circle').mockReturnValue(circle);

        gcs_wrapper.push_primitive({type: 'point', id: 's', x: 0, y: 0, fixed: true});
        gcs_wrapper.push_primitive({type: 'point', id: 'c1', x: 1, y: 2, fixed: true});
        gcs_wrapper.push_primitive({type: 'point', id: 'c2', x: 3, y: 2, fixed: true});
        gcs_wrapper.push_primitive({type: 'point', id: 'e', x: 4, y: 0, fixed: true});
        gcs_wrapper.push_primitive({type: 'point', id: 'circle-center', x: 1, y: 2, fixed: true});
        gcs_wrapper.push_primitive({type: 'circle', id: 'weight-circle', c_id: 'circle-center', radius: 1});
        gcs_wrapper.push_primitive({
            type: 'bspline',
            id: 'b1',
            start_id: 's',
            end_id: 'e',
            control_points: ['s', 'c1', 'c2', 'e'],
            weights: [1, 1, 1, 1],
            knots: [0, 1],
            multiplicities: [4, 4],
            degree: 3,
            periodic: false,
        });

        gcs_wrapper.push_primitive({
            type: 'internal_alignment_bspline_control_point',
            id: 'align-pole',
            b_id: 'b1',
            c_id: 'weight-circle',
            poleindex: 1,
        });

        expect(gcs.add_constraint_internal_alignment_bspline_control_point)
            .toHaveBeenCalledWith(bspline, circle, 1, 8, true, 1);
        expect(bspline.delete).toHaveBeenCalledTimes(0);
        expect(circle.delete).toHaveBeenCalledTimes(0);

        gcs_wrapper.clear_data();

        expect(bspline.delete).toHaveBeenCalledTimes(1);
        expect(circle.delete).toHaveBeenCalledTimes(1);
    });

    it("calls correctly the arc2arc perpendicular constraint with boolean parameters", () => {
        gcs_wrapper.push_primitive({type: 'point', id: '1', x: 0, y: 0, fixed: false});
        gcs_wrapper.push_primitive({type: 'point', id: '2', x: 1, y: 2, fixed: false});
        gcs_wrapper.push_primitive({type: 'line', id: '3', p1_id: '1', p2_id: '2'});
        gcs_wrapper.push_primitive({type: 'point', id: '4', x: 10, y: 10, fixed: false});
        gcs_wrapper.push_primitive({type: 'arc', id: '5', c_id: '1', start_id: '2', end_id: '4', start_angle: 0, end_angle: 0, radius: 1});

        const line = { delete: vi.fn() };
        const point = { delete: vi.fn() };
        const arc = { delete: vi.fn() };
        vi.spyOn(gcs, 'make_line').mockReturnValue(line);
        vi.spyOn(gcs, 'make_point').mockReturnValue(point);
        vi.spyOn(gcs, 'make_arc').mockReturnValue(arc);

        gcs_wrapper.push_primitive({
            type: 'perpendicular_arc2arc',
            id: '6',
            a1_id: '5',
            a2_id: '5',
            reverse1: false,
            reverse2: true,
        }); 
    });

    it("translates redundant constraints from gcs number ids to primitive string ids", () => {
        const redundant = [2, 3];

        vi.spyOn(gcs, 'get_redundant').mockReturnValueOnce({
            get: (index: number) => redundant[index],
            size: () => redundant.length,
            delete: () => vi.fn(),
            push_back: vi.fn()
        });

        gcs_wrapper.push_primitive({type: 'point', id: '1', x: 0, y: 0, fixed: false});
        gcs_wrapper.push_primitive({type: 'equal', id: '2-equal', param1: { o_id: '1', prop: 'x' }, param2: 5});
        gcs_wrapper.push_primitive({type: 'equal', id: '3-equal', param1: { o_id: '1', prop: 'x' }, param2: 5});

        const redundant_ids = gcs_wrapper.get_gcs_redundant_constraints();

        expect(redundant_ids).toEqual(['2-equal', '3-equal']);
    });
});
