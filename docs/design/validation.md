# Architecture artifact validation

This records the original schema and database-model checks from 2 October 2026. The repository now contains executable flow, interaction and coordinator modules. Their implementation tests and live checks are recorded separately in [runtime validation](../validation.md). Capacity and interaction calibration still require measurements.

## Flow formats

The bundled owned-site flow passes strict Ajv validation against both Draft 2020-12 schemas and the artifact linter. The linter checks state/target/step references, refinement cycles, reachable branches, installed policy/resolver names, origin confinement, retry permissions and definite assignment of required inputs, answers, captures and identity receipts.

Run from the repository root after installing the existing project dependencies:

```sh
node docs/design/validate.mjs
```

All 12 malformed fixture checks were rejected: reserved-state override, refinement cycle, unknown target, unsafe submission retry, missing error route, missing choice branch, missing identity receipt, identity-policy downgrade, missing installed policy, unsafe pattern, wildcard pattern and origin escape. The standalone linter executes no browser commands. Runtime compilation now lives in `src/flows/compiler.ts`, with execution tests in `test/flows.test.ts` and maintained schemas in the root `schemas/` directory.

## Coordination SQL

The proposed SQL successfully created 26 tables in a disposable in-memory PGlite 0.5.8 instance. Seven focused schema exercises passed:

1. An anonymous flow, attachment and unreleased expired lease can be represented without an identity binding.
2. Expiring authorization does not allow another lease to claim the same profile.
3. Capacity release without a stop-barrier reference is rejected.
4. An anonymous attachment and lease can be promoted together in one transaction without replacing their IDs.
5. A bound lease cannot be relabeled anonymous while its attachment remains bound.
6. A second current profile binding for the same identity is rejected.
7. A partial identity/binding pair is rejected.

The exercises test data-model constraints, not permission to activate an expired lease. Grant validity, aggregate quotas, proof authenticity, immutable history and allowed state transitions still require the documented coordinator transactions and restricted write roles. PGlite has a single connection and does not validate multi-node races, database failover or remote-process fencing. Those remain phase-3 tests against a real PostgreSQL deployment and controlled agents.

That design-time check applied no server migration and used a dependency installed under ignored `.workbench/design-validation`. Managed-mode startup now applies the executable migrations in `src/coordinator/migrations/`. The earlier PGlite result should not be confused with a multi-process recovery test.

## Documentation and numerical checks

The seven component diagrams use Mermaid. Local artifact links and code-fence pairing were checked. Capacity-table arithmetic was recomputed from the stated resource, duration, admission, availability and success assumptions. No capacity load test, human-data collection, timing fit or held-out human comparison was part of that artifact check.

The [runtime validation record](../validation.md) separates the earlier script-mode live runs from current implementation tests. A prior browser lifecycle pass does not establish managed recovery or load capacity.
