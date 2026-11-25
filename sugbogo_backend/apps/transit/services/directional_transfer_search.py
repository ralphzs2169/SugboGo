"""Plan and enumerate an opt-in directional graph without expanding global edge products."""

from bisect import bisect_right
from collections import defaultdict
from dataclasses import dataclass, field

# Independent limits on authenticated source rows and bytes buffered per search.
MAX_CONNECTION_RECORDS = 20_000
MAX_CONNECTION_BYTES = 8 * 1024 * 1024
INDEXED_REQUEST_BATCH_SIZE = 1_024


@dataclass
class DirectionalSearchProgress:
    """Expose coverage and work for the development evaluator."""

    stage_status: dict[int, str] = field(default_factory=dict)
    route_sequences: dict[int, int] = field(default_factory=dict)
    repeated_code_sequences: int = 0
    connection_blocks_read: int = 0
    connection_records_read: int = 0
    connection_bytes_read: int = 0
    connections_reconstructed: int = 0
    eligible_connections: int = 0
    forward_positions_rejected: int = 0
    measured_ride_keys: int = 0
    rejected_ride_keys: int = 0
    validated_journeys: dict[int, int] = field(default_factory=lambda: defaultdict(int))


class DirectionalConnectionReadLimit(Exception):
    """Signal that reading the next entire authenticated block exceeds the read limit."""


class _CandidateLimit(Exception):
    """Signal that an additional viable expansion exceeds the shared journey budget."""


class DirectionalTransferSearch:
    """Discover directional sequences from pair metadata and expand ordered positions."""

    def __init__(
        self,
        *,
        positions,
        pairs,
        route_codes,
        max_transfers,
        progress,
        read_pair,
    ):
        """Plan eligible route sequences and each pair's safe shared retrieval bounds."""
        self.progress = progress
        self.stats = progress.directional
        self.read_pair = read_pair
        self.origins = defaultdict(list)
        self.destinations = defaultdict(list)
        for endpoint in positions:
            if endpoint.is_boarding:
                self.origins[endpoint.variant_id].append(endpoint)
            else:
                self.destinations[endpoint.variant_id].append(endpoint)
        self.destination_fractions = {}
        for variant_id, endpoints in self.destinations.items():
            endpoints.sort(key=lambda endpoint: endpoint.position.fraction)
            self.destination_fractions[variant_id] = tuple(
                endpoint.position.fraction
                for endpoint in endpoints
            )
        self.earliest = {
            variant_id: min(endpoint.position.fraction for endpoint in endpoints)
            for variant_id, endpoints in self.origins.items()
        }
        self.latest = {
            variant_id: fractions[-1]
            for variant_id, fractions in self.destination_fractions.items()
        }

        outgoing = defaultdict(set)
        incoming = defaultdict(set)
        for source, target in pairs:
            if source in route_codes and target in route_codes:
                outgoing[source].add(target)
                incoming[target].add(source)
        one = []
        two = []
        for source in sorted(self.origins):
            for target in sorted(outgoing[source] & self.destinations.keys()):
                if route_codes[source] == route_codes[target]:
                    self.stats.repeated_code_sequences += 1
                    continue
                one.append((source, target))
            if max_transfers < 2:
                continue
            for target in sorted(self.destinations):
                for middle in sorted(outgoing[source] & incoming[target]):
                    if len({route_codes[source], route_codes[middle], route_codes[target]}) != 3:
                        self.stats.repeated_code_sequences += 1
                        continue
                    two.append((source, middle, target))

        self.sequences = {1: one}
        if max_transfers == 2:
            self.sequences[2] = two
        self.first_pairs = {(source, middle) for source, middle, _ in two}
        self.last_pairs = {(middle, target) for _, middle, target in two}
        self.stats.route_sequences.update(
            (depth, len(sequences))
            for depth, sequences in self.sequences.items()
        )
        self.pairs = {}
        self.final_pairs = {}

    def _pair(
        self,
        source,
        target,
    ):
        """Cache one canonical pair with bounds valid for every role it may serve."""
        pair = (source, target)
        if pair not in self.pairs:
            earliest = None if pair in self.last_pairs else self.earliest.get(source)
            latest = None if pair in self.first_pairs else self.latest.get(target)
            links = self.read_pair(
                source,
                target,
                earliest_alighting=earliest,
                latest_boarding=latest,
            )
            links.sort(key=lambda link: link.alighting_position.fraction)
            self.pairs[pair] = links
        return self.pairs[pair]

    def _final_pair(
        self,
        source,
        target,
    ):
        """Index only connections with at least one forward destination position."""
        pair = (source, target)
        if pair not in self.final_pairs:
            links = self._pair(source, target)
            self.progress.suffix_links_checked += len(links)
            usable = [
                link
                for link in links
                if link.boarding_position.fraction < self.latest[target]
            ]
            self.stats.forward_positions_rejected += len(links) - len(usable)
            fractions = [link.alighting_position.fraction for link in usable]
            self.final_pairs[pair] = (usable, fractions)
        return self.final_pairs[pair]

    def _charge(
        self,
        counter,
        depth,
    ):
        """Charge the same transfer and endpoint expansions as the legacy traversal."""
        if self.work >= self.limit:
            raise _CandidateLimit
        self.work += 1
        counter[depth] += 1

    def _finishes(
        self,
        start,
        links,
        target,
    ):
        """Generate all forward positions on the final ride."""
        fraction = links[-1].boarding_position.fraction
        offset = bisect_right(self.destination_fractions[target], fraction)
        for index in range(offset, len(self.destinations[target])):
            self._charge(self.progress.destination_options, len(links))
            yield start, links, self.destinations[target][index]

    def _paths(
        self,
        depth,
    ):
        """Enumerate complete position tuples for one depth using forward suffix bounds."""
        charged_prefixes = set()
        for sequence in self.sequences[depth]:
            source, target = sequence[0], sequence[-1]
            if depth == 1:
                first, first_fractions = self._final_pair(source, target)
            else:
                middle = sequence[1]
                edges = self._pair(source, middle)
                if not edges:
                    continue
                last, last_fractions = self._final_pair(middle, target)
                if not last:
                    continue
                self.progress.suffix_links_checked += len(edges)
                first = [
                    link
                    for link in edges
                    if link.boarding_position.fraction < last_fractions[-1]
                ]
                self.stats.forward_positions_rejected += len(edges) - len(first)
                first_fractions = [link.alighting_position.fraction for link in first]
            for origin_index, start in enumerate(self.origins[source]):
                offset = bisect_right(first_fractions, start.position.fraction)
                self.stats.forward_positions_rejected += offset
                for index in range(offset, len(first)):
                    link = first[index]
                    if depth == 1:
                        self._charge(self.progress.transfer_options, 0)
                        yield from self._finishes(start, (link,), target)
                        continue
                    prefix = (
                        source,
                        middle,
                        origin_index,
                        link.alighting_position.fraction,
                        link.boarding_position.fraction,
                    )
                    if prefix not in charged_prefixes:
                        self._charge(self.progress.transfer_options, 0)
                        charged_prefixes.add(prefix)
                    last_offset = bisect_right(last_fractions, link.boarding_position.fraction)
                    self.stats.forward_positions_rejected += last_offset
                    for last_index in range(last_offset, len(last)):
                        self._charge(self.progress.transfer_options, 1)
                        yield from self._finishes(start, (link, last[last_index]), target)

    def paths(
        self,
        *,
        maximum_search_work,
    ):
        """Alternate depths so a dense shallow stage cannot consume all remaining work."""
        self.limit = maximum_search_work
        self.work = (
            sum(self.progress.destination_options.values())
            + sum(self.progress.transfer_options.values())
        )
        active = {depth: iter(self._paths(depth)) for depth in self.sequences}
        read_limited = False
        while active:
            for depth, iterator in tuple(active.items()):
                self.stats.stage_status[depth] = "partial"
                try:
                    yield next(iterator)
                except StopIteration:
                    self.stats.stage_status[depth] = "complete"
                    del active[depth]
                except DirectionalConnectionReadLimit:
                    read_limited = True
                    del active[depth]
                except _CandidateLimit:
                    self.progress.incomplete_reason = "candidate_budget"
                    return
        if read_limited:
            self.progress.incomplete_reason = "connection_budget"
