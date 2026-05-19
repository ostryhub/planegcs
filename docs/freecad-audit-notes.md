# FreeCAD Curve Audit Notes

## Baseline

- FreeCAD checkout: `/Users/rafal/Projects/LTBL/@freecad/freecad-ltbl/freecad-official-repo/FreeCAD`
- FreeCAD commit: `d8a049cdb9c0685484333072b87e7434e1ea7e57`
- PlaneGCS fork commit before Phase 2 curve changes: `46a34bc`
- LTBL plan: `/Users/rafal/Projects/LTBL/ltbl-monorepo-sketcher/docs/@sketcher/planegcs-custom-fork-curves-dof/plan.md`

The existing fork B-spline implementation is treated as experimental. This note records the FreeCAD contract and what must be proven or replaced before LTBL consumes spline or Bezier solving.

## FreeCAD Files Read

- `src/Mod/Sketcher/App/Sketch.cpp`
  - `Sketch::addBSpline`
  - `Sketch::addPointOnObjectConstraint`
  - `Sketch::addTangentLineAtBSplineKnotConstraint`
  - `Sketch::addTangentLineEndpointAtBSplineKnotConstraint`
  - `Sketch::addInternalAlignmentBSplineControlPoint`
  - `Sketch::addInternalAlignmentKnotPoint`
- `src/Mod/Sketcher/App/planegcs/Geo.h`
  - `GCS::BSpline`
- `src/Mod/Sketcher/App/planegcs/Geo.cpp`
  - `BSpline::CalculateNormal`
  - `BSpline::Value`
  - `BSpline::PushOwnParams`
  - `BSpline::ReconstructOnNewPvec`
  - `BSpline::setupFlattenedKnots`
- `src/Mod/Sketcher/App/planegcs/GCS.cpp`
  - `System::addConstraintPointOnBSpline`
  - `System::addConstraintTangentAtBSplineKnot`
  - `System::addConstraintInternalAlignmentBSplineControlPoint`
  - `System::addConstraintInternalAlignmentKnotPoint`
- `src/Mod/Sketcher/App/planegcs/Constraints.cpp`
  - `ConstraintPointOnBSpline`
  - `ConstraintSlopeAtBSplineKnot`
- `src/Mod/Sketcher/Gui/DrawSketchHandlerBSpline.h`
  - control-point and interpolation construction paths
  - auto-created pole/knot internal alignment command flow
- `src/Mod/Sketcher/Gui/CommandSketcherBSpline.cpp`
  - degree, knot multiplicity, insertion, and knot lookup command flow
- `src/Mod/Part/App/Geometry.cpp`
  - `GeomCurve::toBSpline`
  - `GeomBezierCurve`
  - text/symbol Bezier conversion to B-spline before Sketcher geometry creation
- `src/Mod/Part/App/BSplineCurvePyImp.cpp`
  - `BSplineCurvePy::buildFromPolesMultsKnots`
- `tests/src/Mod/Sketcher/App/SketcherTestHelpers.cpp`
  - `createTypicalNonPeriodicBSpline`
  - `createTypicalPeriodicBSpline`
- `tests/src/Mod/Sketcher/App/planegcs/Constraints.cpp`
  - direct PlaneGCS B-spline constraint fixture setup

## FreeCAD Contract

FreeCAD Sketcher solves B-splines through `GCS::BSpline`. It does not expose a separate Sketcher Bezier solver primitive. Bezier curves are Part/OCC geometry and are converted to B-spline/NURBS form before Sketcher solver participation when needed.

`Sketch::addBSpline` clones the `Part::GeomBSplineCurve`, reads poles, weights, unique knots, multiplicities, degree, and periodicity, then creates a `GCS::BSpline` with:

- `poles`: solver `GCS::Point` records backed by x/y solver parameters.
- `weights`: solver parameters.
- `knots`: double pointers used by the B-spline constraints but not pushed into the main `Sketch::Parameters` vector in `Sketch::addBSpline`.
- `mult`: knot multiplicities.
- `degree`: B-spline degree.
- `periodic`: periodic flag.
- `start` and `end`: solver points for the curve endpoints.

Open non-periodic endpoint behavior depends on endpoint multiplicity. If the first or last multiplicity is greater than the degree, FreeCAD adds coincident constraints between the endpoint and the corresponding end pole.

The B-spline C++ type has `PushOwnParams` and `ReconstructOnNewPvec` methods that include knots, but FreeCAD Sketcher does not use `Sketch::addBSpline` to make knots normal user DOF. LTBL should keep knots fixed by default and only expose them as solver DOF when an explicit future curve-editing command opts in.

## Supported Curve Constraints

FreeCAD uses the following direct PlaneGCS curve constraints:

- `point_on_bspline`: adds x and y `ConstraintPointOnBSpline` constraints sharing a curve parameter.
- `tangent_at_bspline_knot`: adds `ConstraintSlopeAtBSplineKnot` between a line and a C1-continuous spline knot.
- `internal_alignment_bspline_control_point`: equates a control circle center to the pole x/y and the control circle radius to the pole weight.
- `internal_alignment_knot_point`: constrains a visible knot point to the weighted linear combination of the poles that affect that knot.

Tangency at a knot is explicitly rejected when the knot is C0-discontinuous. FreeCAD also rejects the current helper path for end-knot tangency and tells users to constrain start/end points instead.

## Bezier Lowering Rule

LTBL will expose Bezier as a first-class sketch entity, but it lowers to a non-periodic B-spline before entering PlaneGCS:

- `degree = controlPointCount - 1`
- `poles = Bezier control points`
- `weights = supplied weights`, defaulting to all `1`
- `knots = [0, 1]`
- `multiplicities = [degree + 1, degree + 1]`
- `periodic = false`

Worked cubic example:

```ts
const bezier = {
  degree: 3,
  poles: [
    [0, 0],
    [1, 2],
    [3, 2],
    [4, 0],
  ],
  weights: [1, 1, 1, 1],
};

const loweredBSpline = {
  degree: 3,
  poles: bezier.poles,
  weights: [1, 1, 1, 1],
  knots: [0, 1],
  multiplicities: [4, 4],
  periodic: false,
};
```

This is the same unique-knot/multiplicity shape FreeCAD accepts via `Part::BSplineCurve(poles, mults, knots, false, degree, weights, CheckRational)`. It is also equivalent to the OCC Bezier-to-B-spline representation for a single Bezier span. LTBL tests must assert this exact lowering before adding UI curve tools.

## Fork Code Audit

Keep, subject to real-wasm tests:

- C++ `GCS::BSpline` and its constraint classes in `planegcs/Geo.*`, `planegcs/GCS.*`, and `planegcs/Constraints.*`, because they match the FreeCAD solver source at the audited commit.
- Generated binding surface for `make_bspline`, `add_constraint_point_on_bspline`, `add_constraint_tangent_at_bspline_knot`, `add_constraint_internal_alignment_bspline_control_point`, and `add_constraint_internal_alignment_knot_point`, but only after hardened tests prove argument order and lifecycle.

Replace or harden before LTBL consumption:

- `sketch/SketchBSpline` must use unique knots plus multiplicities in examples and validation. The current README example uses flattened knots `[0, 0, 0, 0, 1, 1, 1, 1]` with multiplicities `[4, 1, 1, 4]`, which is not the FreeCAD unique-knot contract.
- `sketch/gcs_wrapper.ts` currently pushes `weights` and `knots` as mutable parameters in one block. This disagrees with FreeCAD’s default contract. Weights may be mutable; knots must be fixed by default.
- `sketch/geom_params.ts` describes B-spline start/end offsets as though control points, weights, knots, and endpoints live in one contiguous B-spline-owned parameter block. The wrapper actually stores start, end, and control points as separate point primitives, then stores only B-spline scalar parameters under the B-spline id. This must be corrected or guarded before property references are allowed.
- No `SketchBezier` wrapper exists yet. It must be implemented as a convenience primitive that lowers to `SketchBSpline` with the Bezier lowering rule above.
- Existing fork tests are not sufficient. The current B-spline test only proves `make_bspline` can be called; it does not prove solve behavior, pulled state, point-on-curve, tangent-at-knot, or Bezier lowering parity.

## Scope Limits For LTBL Phase 2

- Non-periodic open splines are in scope.
- Bezier is in scope as a lowered non-periodic B-spline.
- Periodic splines remain fork-supported where existing C++ supports them, but LTBL UI tools do not expose periodic creation in Phase 2.
- Knot editing and knot mutability are out of scope for LTBL Phase 2.
- Rational weights are carried and solved when supplied. UI authoring defaults to non-rational weights of `1`.
- Tangency at arbitrary curve parameter is out of scope.
- Curve-curve tangency is out of scope unless a later FreeCAD audit promotes a tested knot-only mapping.
