# About planegcs

Planegcs is a 2D geometric constraint solver from [FreeCAD](https://github.com/FreeCAD/FreeCAD/tree/main/src/Mod/Sketcher/App/planegcs). This repository is a port of the C++ code to WebAssembly, so that it can be used in the browser or node environments. The solving is based on numeric optimization methods, such as `DogLeg`, `Levenberg-Marquardt`, `BFGS` or `SQP`. Apart from the WebAssembly module and the wrapper class, this library contains complete TypeScript annotations.

This repository includes two PDF documents created by members of the FreeCAD community in the `doc` folder: Sketcher Lecture (by Christoph Blaue), which is a user-level description of FreeCAD's Sketcher, and Solver manual (by Abdullah Tahiri), which is a lower-level description of the planegcs solver.

## Features

- [x] Point, Line, Circle, Arc, Ellipse, Elliptical arc, Hyperbola, Parabola, Hyperbolical arc, Parabolical arc
- [x] All constraints from planegcs (see `planegcs_dist/constraints.ts`)
- [x] Reference sketch parametries or geometry properties in the constraints
- [x] Non-driving and temporary constraints
- [x] Validation code for sketch primitives (in a separate library [planegcs-validation](https://github.com/Salusoft89/planegcs-validation)) 
- [ ] Higher-level data model (WIP)
- [ ] B-Spline
- [ ] Multithreading execution of QR decomposition (GcsSystem.cpp:4811,4883)
- [ ] Support for constraints referencing other constraints

# Example usage

The geometries and constraints are represented by JSON objects, which are called (sketch) primitives. A list of primitives is an input for the solver. The primitives might reference each other by their ids.

```js

const primitives = [ 
    { id: '1', type: 'point', x: 10, y: 10, fixed: false },
    { id: '2', type: 'point', x: 20, y: 20, fixed: false },
 
    { id: '3', type: 'p2p_coincident', p1_id: '1', p2_id: '2' },
 ];

gcs_wrapper.push_primitives_and_params(primitives);
gcs_wrapper.solve();
gcs_wrapper.apply_solution();

console.log(gcs_wrapper.sketch_index.get_primitives());
// outputs
// [
//    { id: '1', type: 'point', x: 10, y: 10, fixed: false },
//    { id: '2', type: 'point', x: 10, y: 10, fixed: false },                <<< x and y changed
//    { id: '3', type: 'p2p_coincident', p1_id: '1', p2_id: '2' },
// ]

```

# Installation and import

Install with `npm install @salusoft89/planegcs`.

The main class for working with planegcs is GcsWrapper and can be instantiated as follows:
```js
import { init_planegcs_module, GcsWrapper } from '@salusoft89/planegcs';
async function init_gcs_wrapper() {
   const mod = await init_planegcs_module();
   const gcs_system_wasm = new mod.GcsSystem();
   const gcs_wrapper = new GcsWrapper(gcs_system_wasm);
   return gcs_wrapper;
}

init_gcs_wrapper().then(gcs_wrapper => {
   do_something_with_gcs_wrapper(gcs_wrapper);

   // explicit de-allocation of the Wasm memory must be called
   gcs_wrapper.destroy_gcs_module();
});
```

If using Vite, then you need to explicitly set the .wasm file import url:
```ts
import wasm_url from "@salusoft89/planegcs/dist/planegcs_dist/planegcs.wasm?url";
// ...
const mod = await init_planegcs_module({ locateFile: () => wasm_url });
// ...
```

# Geometries

This library supports all geometries that are implemented in the original solver:

## Point, Line, Circle
   
```ts
{ id: '1', type: 'point', x: 10, y: 10, fixed: false },
{ id: '2', type: 'point', x: 0, y: 0, fixed: false }
```
When `fixed` is set to true, then the point's coordinates are not changed during solving.

```ts
{ id: '3', type: 'line', p1_id: '1', p2_id: '2' }
```
A line is defined by two points, which must have lower ids.

```ts
{ id: '4', type: 'circle', c_id: CENTER_POINT_ID, radius: 100 }
```

## Arc

An arc requires three points to be defined (center, start, end) and a subsequent planegcs-specific constraint `arc_rules` that keeps the endpoints (start_id, end_id) aligned with the start_angle and end_angle.

```ts
{ id: '5', type: 'arc', c_id: CENTER_POINT_ID, radius: 100,
 start_angle: 0, end_angle: Math.PI / 2,
 start_id: START_POINT_ID, end_id: END_POINT_ID }

{ id: '6', type: 'arc_rules', a_id: '5'  }
```

## Ellipse

An ellipse is represented in planegcs by its minor radius (length of the semi-minor axis) and F1 (one of its focal points):

```ts
{ id: '7', type: 'ellipse', c_id: CENTER_POINT_ID, focus1_id: F1_POINT_ID, radmin: 100 }
```

![ellipse](https://upload.wikimedia.org/wikipedia/commons/9/96/Ellipse-def0.svg)

The ellipse can be further constrained using planegcs-internal constraints for the major and minor diameters:

```ts
{ id: '8', type: 'internal_alignment_ellipse_major_diameter', e_id: '7', p1_id: ..., p2_id: ...}
{ id: '9', type: 'internal_alignment_ellipse_minor_diameter', e_id: '7', p1_id: ..., p2_id: ...}
```

## Elliptical arc

The elliptical arc again requires another constraint to keep the start/end points aligned:

```ts
{ id: '10', type: 'arc_of_ellipse', c_id: CENTER_POINT_ID, focus1_id: F1_POINT_ID,
  radmin: 100, start_angle: 0, end_angle: Math.PI / 2,
  start_id: START_POINT_ID, end_id: END_POINT_ID }

{ id: '11', type: 'arc_of_ellipse_rules', a_id: '10' }
```

Same as for the ellipse, it can be constrained by the major/minor diameter alignment constraints.

## Hyperbola, Parabola, Hyperbolical arc, Parabolical arc

Defined similarly to an ellipse/elliptical arc. See the type definitions in `sketch/sketch_primitive.ts`.

## B-Spline

A B\-Spline is described by its start and end points together with an
arbitrary number of control points.  Each control point has a weight and
the curve parameterisation is controlled by the `knots` and
`multiplicities` arrays.  `degree` specifies the order of the curve and
setting `periodic` to `true` creates a closed spline.

```ts
{ id: '12', type: 'bspline',
  start_id: START_POINT_ID, end_id: END_POINT_ID,
  control_points: [CP1_ID, CP2_ID],
  weights: [1, 1, 1, 1],
  knots: [0, 0, 0, 0, 1, 1, 1, 1],
  multiplicities: [4, 1, 1, 4],
  degree: 3, periodic: false }
```
![B-spline](data:image/png;base64,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ehRLlixBdXW17FKISMWSkpIMN43FAGnHsmXLsGnTJj6qlojalJiYaLhpLAZIG/i0QSLqKCNe8c4AacOyZct45xURddi0adPQu3dvGGVrmZvoN1FaWoohQ4bwxl0ioptggLThwIED+N73vsflKyLqsKtXr+LgwYN44IEHZJfid1zCakV1dTWEELj//vsZHkTUKX/84x/xwx/+0BDTWAyQVvz85z/H5MmTZZdBRBqUkJBgmGksBsh1PJNXEyZMkF0KEWmQkaaxGCDX4bPOiairUlJSDHGokAHSDM99EJEvJCYm4t5770V5ebnsUvyKlyk2U1JSgjFjxrD7IKIusVqt+PTTT2WX4Xcc472OEAImk0l2GUSkcUIIHDhwAKNGjUKfPn1kl+MXXML6TmZmJk6fPs3wICKfKC8vxwMPPIAPPvhAdil+wwCBsveRmpqq679oIgqsiIgIxMbGYsuWLbJL8RsGCK5NXj311FOySyEiHUlJScHOnTt1O41l+ADh5BUR+Yver3g3fIDw3AcR+YvVasWTTz4puwy/MfwU1qFDh3DmzBmePCci6iRDBwhHdokoEEpKSlBTU4M777xTdik+ZdglLLvdjrvvvhvFxcWySyEinZs2bRoWL14suwyfM2yApKWl4eLFi7j99ttll0JEOqfXaSxDBggnr4gokPQ6jWXIPZCpU6diz549cDgcDBAiCoi4uDhYLBYUFBTILsVnDNeB1NbWYt++few+iCigUlNTERERAT39zm7IDqSurg4mkwkhISGySyEi0ixDdSClpaUoKSlB9+7dGR5EFHCVlZXYvXu37DJ8xlAB8sILL+BHP/oR3G637FKIyIAyMzMxadIk3UxjGSZAPJNXixYtQlCQYf7YRKQiepvGMsweyJQpU7B3715OXhGRVPHx8QgLC9PFNJYhfhXnuQ8iUovk5GTdHCo0RID07NkTv/jFL3jjLhFJl5iYiPHjx+PcuXOyS+kywyxhERGRb+m+A1m8eDFycnJkl0FE1KShoQE7d+7EpUuXZJfSJboOELvdjtdffx1nz56VXQoRUZOKigpMmDAB27Ztk11Kl+h6CYt3XhGRWulhGku3HQgnr4hIzfQwjaXbAHnrrbf4rHMiUi09HCrUbYC89tpr2L17N7sPIlIlq9WKp556Cj179pRditd0uQdy5swZDBo0SHYZRES6prsOxG63IzIyEjt37pRdChFRuw4fPox//OMfssvwiu46EE5eEZGWaPlJhbrqQDh5RURao+VpLF0FSFpaGieviEhTPNNYWjxUqJsAEUIgLCwMv/3tb9l9EJFm2Gw2xMbGIjs7W3YpnRYsuwBfMZlMWLt2rewyiIg6bfbs2Thy5AiEEDCZTLLL6TBdbKIfPXoUH330EebMmcNnnRMRBYgulrCWLVuGV199FTrIQiIyqDNnzmjuVLrmA4STV0SkB5s3b0ZSUpKmprE0HyCcvCIiPdDiNJamA6S4uJjdBxHpghansTQdIMOGDUNOTg67DyLSBa0dKtTsGG9jYyOCg4MxefJk2aUQEflEUlIS9u3bh8rKSlgsFtnltEuzY7zTpk1DaGgo1q1bJ7sUIiJD0uQSlt1ux5///GfcddddskshIvKpK1euIDs7WxPLWJoMkGXLlnHyioh06cKFC0hJSdHENJbmAoTnPohIz6xWq2amsTQXIF988QXuuOMOdh9EpFtamcbS5Ca6ZwKLiEiPysrKYLPZsGHDBsyYMUN2OTelqQ4kPz8f1dXVDA8i0jWr1Yp58+ahX79+sktpk2Y6ELvdjpiYGKxbtw7PPPOM7HKIiAxPMwHCZ50TkdF88skn6NatG+6//37ZpbRKEwHi6T7WrFmDuXPnyi6HiCgg4uLiYLFYUFBQILuUVmliD4Q37hKREal9GksTATJ16lSsXr2aS1dEZChJSUmqvuJdE0tYRERGpeZlLFV3IHa7HRMmTEBZWZnsUoiIpHj22WcxduxY2WW0StUdCCeviIjUS7UdCO+8IiJSlJSUYPPmzbLLuIFqA4STV0REiry8PEybNk1101iqDJDKykp8+OGH7D6IiHBtGisvL092KS2odg/k/PnzuOWWWxggRERQprH69u2L/Px82aU0UV0HUl5ejsrKSvTr14/hQUT0neTkZOzYsUNVy1iqu9Z20aJFOHToEA4fPgyTySS7HCIiVUhKSsKRI0dQU1MDi8UiuxwAKlvC4p1XRETaoaolLE5eERHdXFVVFd555x3VLGOpJkB47oOIqG2XL1/GU089pZppLNUESENDA5KTk9l9EBHdhNVqRWxsLLKzs2WXAkBleyBERNS2VatWYdGiRaioqJC+mS4tQFwuF4qKilBeXo7du3djypQpeOihh2SUQkSkGWVlZbDZbFi8eDFGjx6N8PBwxMfHw2w2B7wWKQGSm5uLBQsW4NSpU02vWSwWrF+/HgkJCYEuh4hIM3JzczFz5kxUVVU1vWaz2bBq1aqA//wMeIDk5uYiKSkJ139bz5mPnJwchggRUSvU9vMzoAHicrkQFRXVovNoUYzJBJvNhpKSEintGBGRWqnx52dAp7CKiopu+ocHACEETp48iaKiogBWRUSkfmr8+RnQACkvL/fp5xERGYUaf34GNEDCw8N9+nlEREahxp+fUvZAysrKbtgEArgHQkR0M2r8+RnQDsRsNmPVqlUAcMNNu56PMzIyGB5ERNdR48/PgF9lkpCQgJycHFit1hav22w2jvASEbVBbT8/VXESXeZJSiIirVHLz0/ehUVERF5RzW28RESkLQwQIiLyCgOEiIi8wgAhIiKvMECIiMgrDBAiIvIKA4SIiLzCACEiIq8wQIiIyCsMECIi8goDhIiIvMIAISIirzBAiIjIKwwQIiLyCgOEiIi8wgAhIiKvMECIiMgr/w/bn/SsRnpWPgAAAABJRU5ErkJggg==)
An HTML version of this diagram is available at [doc/bspline_example.html](doc/bspline_example.html)


The following constraint types are available for B\-Splines:

- `tangent_at_bspline_knot`
- `point_on_bspline`
- `internal_alignment_bspline_control_point`
- `internal_alignment_knot_point`

```ts
const bspline = { /* as above */ };
const primitives = [
    { id: 'p1', type: 'point', x: 1, y: 1, fixed: false },
    bspline,
    { id: 'c1', type: 'point_on_bspline', p_id: 'p1', b_id: '12', pointparam: 0.5 }
];
gcs_wrapper.push_primitives_and_params(primitives);
gcs_wrapper.solve();
```

# Constraints

Planegcs supports a wide range of constraints. All available constraint types are in `planegcs_dist/constraints.ts`.

The values of the constraints can be set direclty as a number, reference a sketch parameter, or reference a property of a geometry with lower ID:

1. Parameter value as a number:
```ts
{ id: '3', type: 'p2p_distance', p1_id: '1', p2_id: '2', distance: 100 }
```

2. Parameter value as a reference to a sketch parameter:
```ts
{ id: '3', type: 'p2p_angle', p1_id: '1', p2_id: '2', angle: 'my_distance' }
```

3. Parameter value as a reference to a property of a geometry with ID o_id
```ts
{ 
   id: '3', 
   type: 'difference',
   param1: {
      o_id: '1',
      prop: 'x',
   },
   param2: {
      o_id: '2',
      prop: 'y',
   },
   difference: 100,
}
```
Currently, the object referenced with o_id can be only a geometry, referencing constraints is not supported.

## Driving, Temporary flags and Scale

Each constraint has following (optional) properties:

- `driving` (default true) - if set to false, then the constraint doesn't influence the geometries during solving, but instead can be used for measurements

    - **There are some constraints (CircleDiameter, ArcDiameter, C2CDistance, C2LDistance, P2CDistance, ArcLength and probably some other) that don't work properly when set to non-driving.** (this requires further digging into the planegcs solver)

- `temporary` (default false) - if set to true, then the constraint is only enforced so much that it doesn't conflict with other constraints. This is useful for constraints for mouse dragging in a Sketcher user interface. Temporary constraints don't reduce DOF. The presence of temporary constraints changes the algorithm used for solving in planegcs, regardless of the configured algorithm.

- `scale` (default 1) - sets the scale for an error of a constraint. Scale lower than 1 makes the constraint less prioritized by the solver and vice versa.

# Solving

Following methods can be called in the GcsWrapper to change the behavior of solving:

- `set_max_iterations(max_iterations: number)` - sets the maximum number of iterations for the solver. Default is 100.
- `set_convergence_threshold(convergence_threshold: number)` - sets the convergence threshold for the solver. Default is 1e-10.
- `set_debug_mode(debug_mode: DebugMode)` - sets the level of Debug, where DebugMode is NoDebug, Minimal, or IterationLevel

Furthermore, the solving can be altered via setting the algorithm to the solve method:

- `solve(algorithm: Algorithm)` - where Algorithm is an enum with following values: [DogLeg](https://en.wikipedia.org/wiki/Powell%27s_dog_leg_method), [LevenbergMarquardt](https://en.wikipedia.org/wiki/Levenberg%E2%80%93Marquardt_algorithm), or [BFGS](https://en.wikipedia.org/wiki/Broyden%E2%80%93Fletcher%E2%80%93Goldfarb%E2%80%93Shanno_algorithm). Default is DogLeg.

Note: when the sketch containts constraints with a flag `temporary` set to true, then the parameter is ignored and instead the [SQP](https://en.wikipedia.org/wiki/Sequential_quadratic_programming) algorithm is used.

# Developing

Install [Docker](https://docs.docker.com/get-docker/) and [Node.js](https://nodejs.org/en).

Run `npm install` to install the dependencies.

Build command: `npm run build:all`, which consists of these steps:
   - `npm run build:docker` - pulls/builds the docker image for building C++ files from FreeCAD
   - `npm run build:bindings` - creates a C++ binding for the FreeCAD API (partly by scanning the source code)
   - `npm run build:wasm` - builds the planegcs.wasm and planegcs.js files from the C++ binding and source files

To run a script that updates the FreeCAD source files, run `npm run update-freecad`. It is not guaranteed that the parsing scripts will work with newer versions of FreeCAD, so you may have to adjust them.

# Tests

The tests for the library are in the `test` folder and can be run with `npm test`. A subset of tests that doesn't require the compiled WebAssembly module can be run with `npm run test:basic`.


# Further materials

This library was a part of creating my thesis (included in the repo in `docs/sketcher-thesis.pdf`). Though it might be a bit outdated, this thesis
describes how the UI for sketching was implemented using this library. The thesis also includes some background around the maths behind the numerical optimization methods used in this solver.

A nicely prepared (interactive) resource about geometric constraint solving is [CAD in 1 hour](https://fab.cba.mit.edu/classes/865.24/topics/design-tools/#constraints) from an MIT course, accompanied by a [video lesson](https://mit.zoom.us/rec/share/mSbxXU1ap3euZp8TjonDAqmOeXrBUwPXN9e-dJ2e2kWVZ_HxQu6PQFhioWVrFPtt.O3SoIRlOUhdLGrsS).
