"""Verify exact identity translation and unchanged indexed connection evidence."""

from dataclasses import replace

from django.test import SimpleTestCase

from apps.transit.services.coordinate_journey_service import _eligible_connections, CoordinateJourneySearchLimits
from apps.transit.services.managed_development_connection_index import ManagedDevelopmentConnectionIndex
from apps.transit.services.tests.test_development_connection_graph_index import GraphIndexFixture


class ManagedDevelopmentConnectionIndexTests(GraphIndexFixture, SimpleTestCase):
    """Map nonmatching managed primary keys without rounding source records."""

    def mapped(self):
        routes = {
            key + 100: geometry
            for key, geometry in self.routes.items()
        }
        codes = {
            key + 100: code
            for key, code in self.codes.items()
        }
        adapter = ManagedDevelopmentConnectionIndex(
            index=self.publish(),
            route_geometries=routes,
            route_codes=codes,
        )
        return adapter, routes, codes

    def test_translation_preserves_full_precision_order_evidence_and_empty_pairs(self):
        adapter, routes, codes = self.mapped()
        adapter.validate_network(route_geometries=routes, route_codes=codes)
        expected = list(adapter.index.connections(1, 2))
        actual = list(adapter.connections(101, 102))
        self.assertEqual(actual, [
            replace(link, from_variant_id=101, to_variant_id=102)
            for link in expected
        ])
        self.assertIn(0.5 + 1e-14, [link.alighting_position.fraction for link in actual])
        self.assertEqual(list(adapter.connections(101, 103)), [])
        self.assertEqual(adapter.block(101, 103).count, 0)
        self.assertIn((102, 101), set(adapter.nonempty_pairs()))
        with self.assertRaises(KeyError):
            adapter.block(101, 999)
        usable = _eligible_connections(
            candidates=actual,
            routes=routes,
            route_codes=codes,
            limits=CoordinateJourneySearchLimits(),
            allow_provisional_transfers=True,
        )
        self.assertEqual(len(usable[101]), len(actual) - 1)

    def test_missing_and_ambiguous_managed_identities_are_rejected(self):
        adapter, routes, codes = self.mapped()
        for changed_routes, changed_codes in (
            ({key: value for key, value in routes.items() if key != 101}, codes),
            ({**routes, 999: routes[101]}, {**codes, 999: codes[101]}),
        ):
            with self.assertRaises(ValueError):
                ManagedDevelopmentConnectionIndex(
                    index=adapter.index,
                    route_geometries=changed_routes,
                    route_codes=changed_codes,
                )

    def test_extra_route_code_does_not_alias_identical_geometry(self):
        adapter, routes, codes = self.mapped()
        routes[999] = routes[101]
        codes[999] = "extra"
        extra = ManagedDevelopmentConnectionIndex(
            index=adapter.index,
            route_geometries=routes,
            route_codes=codes,
        )
        self.assertEqual(extra.uncovered_variant_ids, (999,))
        self.assertEqual(extra.graph_to_managed[1], 101)
        codes[101] = "changed"
        with self.assertRaises(ValueError):
            extra.validate_network(route_geometries=routes, route_codes=codes)
