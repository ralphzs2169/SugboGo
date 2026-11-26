"""Translate verified artifact identities to current managed route variants."""

from collections import defaultdict
from dataclasses import replace


class ManagedDevelopmentConnectionIndex:
    """Adapt indexed reads without treating artifact IDs as database primary keys."""

    def __init__(
        self,
        *,
        index,
        route_geometries,
        route_codes,
    ):
        """Require an unambiguous exact match for every graph direction."""
        self.index = index
        self.identities = {
            variant_id: (route_codes[variant_id], geometry.hexewkb.decode())
            for variant_id, geometry in route_geometries.items()
        }
        managed = defaultdict(list)
        for variant_id, identity in self.identities.items():
            managed[identity].append(variant_id)
        self.graph_to_managed = {}
        for graph_id, identity in index.variant_identities().items():
            matches = managed[identity]
            if len(matches) != 1:
                raise ValueError(f"Graph variant {graph_id} has no unique managed match.")
            self.graph_to_managed[graph_id] = matches[0]
        self.managed_to_graph = {
            managed_id: graph_id
            for graph_id, managed_id in self.graph_to_managed.items()
        }
        if len(self.managed_to_graph) != len(self.graph_to_managed):
            raise ValueError("Graph directions do not map to distinct managed variants.")
        self.uncovered_variant_ids = tuple(sorted(
            self.identities.keys() - self.managed_to_graph.keys()
        ))

    def validate_network(
        self,
        *,
        route_geometries,
        route_codes,
    ):
        """Reject changed request identities while preserving extra direct routes."""
        identities = {
            variant_id: (route_codes[variant_id], geometry.hexewkb.decode())
            for variant_id, geometry in route_geometries.items()
        }
        if identities != self.identities:
            raise ValueError("The managed network changed after graph mapping.")
        self.index.validate_network(
            route_geometries={
                graph_id: route_geometries[managed_id]
                for graph_id, managed_id in self.graph_to_managed.items()
            },
            route_codes={
                graph_id: route_codes[managed_id]
                for graph_id, managed_id in self.graph_to_managed.items()
            },
        )

    def nonempty_pairs(self):
        """Translate conservative directional connectivity to managed identities."""
        return (
            (self.graph_to_managed[source], self.graph_to_managed[target])
            for source, target in self.index.nonempty_pairs()
        )

    def block(
        self,
        source,
        target,
    ):
        """Retain the original authenticated byte and record accounting."""
        return self.index.block(
            self.managed_to_graph[source],
            self.managed_to_graph[target],
        )

    def connections(
        self,
        source,
        target,
        **bounds,
    ):
        """Translate only IDs and preserve exact fractions, coordinates and evidence."""
        for connection in self.index.connections(
            self.managed_to_graph[source],
            self.managed_to_graph[target],
            **bounds,
        ):
            yield replace(
                connection,
                from_variant_id=source,
                to_variant_id=target,
            )
