"""Present sanitized report evidence as a merchant-facing document."""

from datetime import datetime, timedelta
import json
from zoneinfo import ZoneInfo

from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import CondPageBreak, LongTable, PageBreak, Paragraph, Spacer, TableStyle


class MerchantReportLayout:
    """Organize existing measurements around the questions a merchant needs answered."""

    LABELS = {
        "impressions": "Business appearances", "profile_visits": "Profile visits",
        "distinct_profile_visitors": "Unique profile visitors", "saves": "Pocket saves",
        "distinct_savers": "Unique people saving", "specialty_support": "Retained specialty support",
        "positive_review_share": "Positive review share",
    }
    REASONS = {
        "coverage_unverified": "Tracking coverage is unverified; a growth rate would be unreliable.",
        "peer_group_too_small": "Too few eligible businesses to show a comparison.",
        "merchant_sentiment_sample_too_small": "Your business has too few classified reviews for this comparison.",
        "peer_sentiment_sample_too_small": "Too few peers have enough classified reviews for this comparison.",
        "visibility_unavailable": "Activity tracking could not be read. Try exporting again later.",
        "insufficient_data": "There is not enough evidence for this comparison.",
        "zero_previous_value": "The previous period is zero, so a percentage change cannot be shown.",
        "data_unavailable": "The data needed for this comparison is unavailable.",
        "missing_value": "One of the values needed for this comparison is missing.",
        "missing_or_zero_denominator": "One period has no eligible reviews, so reply rates cannot be compared.",
        "insufficient_sample": "There are too few observations for a reliable comparison.",
        "freshness_unverified": "The latest complete data cutoff has not been verified.",
        "source_partial": "Some source results have limitations.",
        "source_unavailable": "This source could not be read.",
        "current_day_incomplete": "Today's reporting window is still in progress.",
        "current_state_reporting": "Counts use records that are still present in their current state.",
        "retained_valid_vouches_only": "Only endorsements that are still valid are counted.",
        "review_status_history_unavailable": "Earlier review publication or moderation states are not reconstructed.",
        "reply_deletion_history_unavailable": "Deleted replies and original reply times cannot be reconstructed.",
        "stored_summary_uses_own_coverage": "The stored summary has its own review window.",
        "stored_summary_missing": "There is no stored review summary yet.",
        "peer_lifetimes_not_normalized": "Peer comparisons do not adjust for how long businesses have been listed.",
    }

    def __init__(self, renderer, glyphs):
        """Reuse the renderer's approved typography, colors and safe text handling."""
        self.renderer = renderer
        self.glyphs = glyphs
        self.body = ParagraphStyle("MerchantBody", fontName=renderer.FONT, fontSize=9, leading=13,
                                   textColor=renderer.TEXT, spaceAfter=5, splitLongWords=True)
        self.small = ParagraphStyle("MerchantSmall", parent=self.body, fontSize=8, leading=11,
                                    textColor=renderer.MUTED)
        self.heading = ParagraphStyle("MerchantHeading", parent=self.body, fontName=renderer.BOLD,
                                      fontSize=16, leading=21, spaceAfter=12)
        self.title = ParagraphStyle("MerchantTitle", parent=self.heading, fontSize=25, leading=30)
        self.story = []

    def p(self, value, style=None):
        """Create an escaped paragraph using the renderer's visible Unicode fallback."""
        return Paragraph(self.renderer.text(value, self.glyphs), style or self.body)

    @staticmethod
    def number(value, percent=False):
        """Show missing values separately from real zeros and label percentage units."""
        if value is None:
            return "Not available"
        formatted = f"{value:,.2f}".rstrip("0").rstrip(".")
        return formatted + "%" if percent else formatted

    @staticmethod
    def date(value, timestamp=False):
        """Display dates and timestamps in Manila time with human-readable month names."""
        if not value:
            return "Not available"
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo:
            parsed = parsed.astimezone(ZoneInfo("Asia/Manila"))
        return parsed.strftime("%d %b %Y, %I:%M %p") + " (Manila)" if timestamp else parsed.strftime("%d %b %Y")

    @classmethod
    def reason(cls, value):
        """Explain known suppression reasons and safely humanize future reason labels."""
        return cls.REASONS.get(value, str(value or "Not enough evidence to show this result.").replace("_", " ").capitalize())

    def table(self, headers, rows, widths=None):
        """Append compact tables with descriptive headers that repeat across page breaks."""
        rows = list(rows)
        if not rows:
            self.story.append(self.p("No recorded entries in this period.", self.small))
            return
        result = LongTable(
            [[self.p(cell) for cell in headers]] + [[self.p(cell) for cell in row] for row in rows],
            colWidths=widths or [507 / len(headers)] * len(headers), repeatRows=1,
            splitByRow=1, splitInRow=1, hAlign="LEFT",
        )
        result.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), self.renderer.BACKGROUND),
            ("LINEBELOW", (0, 0), (-1, 0), 1, self.renderer.BRAND),
            ("LINEBELOW", (0, 1), (-1, -1), 0.3, self.renderer.BORDER),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        self.story.extend([result, Spacer(1, 10)])

    def section(self, title, note=None, new_page=False):
        """Keep section headings with enough space for their opening explanation."""
        self.story.extend([PageBreak() if new_page else CondPageBreak(110), Spacer(1, 12), self.p(title, self.heading)])
        if note:
            self.story.append(self.p(note))

    def change(self, value):
        """Render authoritative comparisons without deriving missing growth from totals."""
        if value["value"] is None:
            return self.reason(value.get("reason"))
        if value["unit"] == "count":
            if value["value"] == 0:
                return "No change"
            return f"{value['value']:+d} vs previous period"
        unit = "percentage points" if value["unit"] == "percentage_points" else "%"
        return f"{value['value']:+.2f} {unit} ({str(value.get('direction') or '').replace('_', ' ')})"

    def source(self, metadata):
        """Link each result to its deduplicated source status and reporting-window notes."""
        reference, _ = self.metadata_refs[json.dumps(metadata, sort_keys=True)]
        return f"Source {reference} ({metadata['availability']}); see the final pages for coverage and freshness."

    def overview(self, report):
        """Lead with period totals, current workload and a short actionable reading guide."""
        standard = report["results"]["standard"]
        period = report["meta"]["period"]
        self.story.extend([self.p("SugboGo", self.heading), self.p("Your business report", self.title),
                           self.p(report["business"]["name"], self.heading),
                           self.p(f"{self.date(period['start_date'])} to {self.date(period['end_date'])} | Asia/Manila"),
                           self.p(f"Prepared {self.date(report['snapshot_as_of'], True)}", self.small), Spacer(1, 14)])
        self.table(["During your selected dates", "Recorded result"], [
            ("Profile visits", self.number(standard["profile_visits"])),
            ("Unique profile visitors", self.number(standard["distinct_profile_visitors"])),
            ("Pocket save events", self.number(standard["saves_in_period"])),
            ("New published reviews", self.number(standard["reviews"]["new_published_in_period"])),
            ("Vouches added - still valid today", self.number(standard.get("vouches_added_and_still_valid"))),
        ], [330, 177])
        self.table(["At the time this report was prepared", "Current total"], [
            ("People keeping your business in their Pocket", self.number(standard["current_pocket_holders"])),
            ("Published reviews across all dates", self.number(standard["reviews"]["current_published_total"])),
            ("Published reviews waiting for a reply", self.number(standard["reviews"]["current_unanswered_published"])),
        ], [330, 177])
        self.story.append(self.p("These are recorded observations. Tracking may be incomplete. A zero means no recorded activity; 'Not available' means the result could not be provided.", self.small))
        self.story.append(self.p(self.source(standard["meta"]), self.small))
        specialties = report["results"]["premium"]["specialties"]
        if "vouches_added_change" in specialties:
            self.story.append(self.p(
                "Retained vouch additions: "
                + self.change(specialties["vouches_added_change"])
                + ". Both periods count surviving valid vouches on currently active specialties. "
                "Removal or invalidation can revise these counts; this is not net growth.",
                self.small,
            ))
        self.section("What needs your attention")
        actions = report["recommended_actions"]
        for index, item in enumerate(actions, 1):
            message = {
                "UNANSWERED_REVIEWS": "Review published reviews waiting for your reply and respond where appropriate.",
                "INSUFFICIENT_SENTIMENT": "Wait for more reviews to receive sentiment labels before drawing conclusions about customer sentiment.",
            }.get(item["code"], item["message"])
            self.story.append(self.p(f"{index}. {message}"))
        if not actions:
            self.story.append(self.p("No recommended actions were returned for this report."))
        self.story.append(self.p("Read the next pages for activity, reviews and specialty support. Source and measurement notes appear at the end.", self.small))

    def activity(self, premium):
        """Compare activity totals and show sparse observation buckets without filling gaps."""
        self.section("How customers found and saved you", new_page=True)
        self.story.append(self.p("Business appearances count recorded impressions. Visits count recorded profile openings. Saves count save events, which differ from the current number of Pocket holders."))
        for name, title in (("visibility", "Discovery activity"), ("pocket", "Pocket activity")):
            data = premium[name]
            self.section(title)
            self.table(["Measure", "Selected period", "Previous period"], [
                (self.LABELS[key], self.number(metric["value"]), self.number(metric["previous_value"]))
                for key, metric in data["metrics"].items()
            ], [247, 130, 130])
            comparisons = list(dict.fromkeys(self.change(metric["change"]) for metric in data["metrics"].values()))
            for comparison in comparisons:
                labels = ", ".join(self.LABELS[key] for key, metric in data["metrics"].items() if self.change(metric["change"]) == comparison)
                self.story.append(self.p(f"Growth for {labels.lower()}: {comparison}", self.small))
            sources = []
            for key, metric in data["metrics"].items():
                current_ref, _ = self.metadata_refs[json.dumps(metric["sources"]["current"], sort_keys=True)]
                previous_ref, _ = self.metadata_refs[json.dumps(metric["sources"]["previous"], sort_keys=True)]
                sources.append(f"{self.LABELS[key]}: selected {current_ref}, previous {previous_ref}")
            self.story.append(self.p("Sources: " + "; ".join(sources) + ". See final source notes.", self.small))
            self.section(f"{data['interval'].capitalize()} recorded activity")
            self.story.append(self.p("Only returned observation buckets are shown. Missing rows do not prove zero activity. Unique people across the full period must not be added from these rows.", self.small))
            keys = list(data["metrics"])
            dates = sorted({row["date"] for metric in data["metrics"].values() for row in metric["series"] or []})
            values = {key: {row["date"]: row["value"] for row in data["metrics"][key]["series"] or []} for key in keys}
            self.table(["Bucket begins (Manila)"] + [self.LABELS[key] for key in keys], [
                [self.date(day)] + [self.number(values[key][day]) if day in values[key] else
                                   "Not available" if data["metrics"][key]["series"] is None else "No returned bucket"
                                   for key in keys] for day in dates
            ])
            if any(metric["series"] is None for metric in data["metrics"].values()):
                self.story.append(self.p("Some activity series are not available. Missing series have not been replaced with zeros."))

    def reviews(self, premium):
        """Separate review cohorts, reply workload and safely gated stored insights."""
        data = premium["review_performance"]
        current = data["current"]
        self.section("Reviews and your responses", "These results concern reviews created during the selected dates and still published when this report was prepared.", new_page=True)
        self.story.append(self.p(self.source(data["meta"]), self.small))
        fields = [("published_review_count", "Published reviews", False), ("replied_review_count", "Reviews with a qualifying reply", False),
                  ("unanswered_cohort_count", "Reviews without a qualifying reply", False), ("reply_rate", "Reply rate", True),
                  ("classified_review_count", "Reviews with a sentiment label", False), ("unclassified_review_count", "Reviews without a sentiment label", False)]
        self.table(["Measure", "Selected period", "Previous period"], [
            (label, self.number(current[key], percent), self.number(data["previous"][key], percent)) for key, label, percent in fields
        ], [247, 130, 130])
        self.story.append(self.p(f"Reply-rate change: {self.change(data['reply_rate_change'])}"))
        seconds = current["median_first_reply_seconds"]
        self.story.append(self.p(f"Typical first reply (median): {'Not available' if seconds is None else f'{seconds / 3600:,.1f} hours'}. Based on {current['median_replied_sample_size']} replied reviews.", self.small))
        self.story.append(self.p(f"Current backlog across all dates: {data['current_unanswered_published']} published reviews without a qualifying reply. Replies counted through {self.date(data['reply_cutoff'], True)}. Excluded reply timestamps: {data['excluded_reply_timestamp_count']}.", self.small))
        self.section("How reviewers felt")
        if not current["has_sufficient_sentiment_data"]:
            self.story.append(self.p("Too few classified reviews to draw a sentiment conclusion. Percentages are shown only where the source permits them."))
        self.table(["Sentiment", "Selected: count / share", "Previous: count / share"], [
            (key.capitalize(),
             f"{self.number(value['count'])} / {self.number(value['percentage'] if current['has_sufficient_sentiment_data'] else None, True)}",
             f"{self.number(data['previous']['sentiment'][key]['count'])} / {self.number(data['previous']['sentiment'][key]['percentage'] if data['previous']['has_sufficient_sentiment_data'] else None, True)}")
            for key, value in current["sentiment"].items()
        ])
        self.story.append(self.p("Shares use only classified reviews in each period; an insufficient sample is shown as 'Not available'. Unclassified reviews are excluded from these percentages.", self.small))
        self.section("Weekly review activity")
        self.table(["Week begins", "Published", "Replied", "Reply rate"], [
            (self.date(row["date"]), self.number(row["published_review_count"]), self.number(row["replied_review_count"]), self.number(row["reply_rate"], True)) for row in data["series"]
        ])
        summary = premium["review_insights"]["stored_summary"]
        if summary:
            self.section("Stored review summary", "This summary has its own coverage window; it does not change to match the dates chosen above.")
            self.story.append(self.p(self.source(premium["review_insights"]["meta"]), self.small))
            self.story.append(self.p(summary.get("state_message") or self.reason(summary["state"])))
            self.table(["Summary coverage", "Details"], [
                ("Review window", f"{self.date(summary.get('coverage_start'), True)} to {self.date(summary.get('coverage_end'), True)}"),
                ("Generated", self.date(summary.get("generated_at"), True)),
                ("Reviews analyzed / eligible", f"{summary['analyzed_review_count']} / {summary['eligible_review_count']}"),
                ("Used a subset of eligible reviews", "Yes" if summary["is_sampled"] else "No"),
                ("Generation policy version", summary.get("policy", {}).get("generated_version") or "Unknown (legacy summary)"),
            ], [200, 307])
            if summary["content_available"]:
                self.story.append(self.p(summary.get("narrative") or "No narrative available."))
                self.table(["Frequently mentioned topic", "Analyzed reviews mentioning it"], [
                    (item["label"], self.number(item["count"])) for item in summary.get("frequent_mentions", [])
                ])
                self.story.append(self.p("Mentions do not by themselves indicate praise or concern.", self.small))

    def support_and_peers(self, report):
        """Explain retained support and anonymous peer medians without ranking business quality."""
        premium = report["results"]["premium"]
        self.section("Specialty support and peer context", new_page=True)
        self.story.append(self.p(self.source(premium["specialties"]["meta"]), self.small))
        self.story.append(self.p("Specialty endorsements below were added in the selected period and are still valid now. Removed endorsements are excluded, so this is not a historical balance or net growth."))
        self.table(["Specialty", "Retained endorsements", "Unique supporters"], [
            (row["specialty_name"], self.number(row["added_and_still_valid"]), self.number(row["distinct_supporters"]))
            for row in premium["specialties"]["specialties"]
        ], [247, 130, 130])
        for specialty in premium["specialties"]["specialties"]:
            if not any(row["added_and_still_valid"] or row["distinct_supporters"] for row in specialty["series"]):
                self.story.append(self.p(f"{specialty['specialty_name']}: zero retained endorsements and zero supporters in every returned weekly bucket.", self.small))
                continue
            self.section(specialty["specialty_name"] + " - weekly support")
            self.table(["Week begins", "Still-valid endorsements", "Unique supporters"], [
                (self.date(row["date"]), self.number(row["added_and_still_valid"]), self.number(row["distinct_supporters"])) for row in specialty["series"]
            ])
        self.section("Current specialty totals", "These totals include all currently valid support, regardless of the selected dates.")
        self.table(["Specialty", "Valid endorsements", "Unique supporters"], [
            (row["specialty_name"], self.number(row["valid_vouches"]), self.number(row["distinct_supporters"]))
            for row in report["results"]["standard"]["specialty_support"]
        ])
        peers = report["peers"]
        group = peers["group"]
        self.section("Anonymous peer comparisons")
        self.story.append(self.p(self.source(peers["meta"]), self.small))
        self.story.append(self.p(f"Comparison group: {'same business category' if group['scope'] == 'category' else 'same business cluster'}, {group['size']} eligible businesses. At least {group['minimum_size']} are needed to disclose a comparison. Your business is excluded from the peer group."))
        if group["fallback_reason"]:
            self.story.append(self.p("The category group was too small, so the broader cluster was used.", self.small))
        self.story.append(self.p("The median is the middle result among eligible peers. It provides context; it does not rank quality or account for how long each business has been listed.", self.small))
        self.table(["Measure", "Your result", "Peer median", "Eligible sample"], [
            (self.LABELS.get(key, metric["label"]), self.number(metric["merchant_value"], metric["unit"] == "percent"),
             self.number(metric["peer_median"], metric["unit"] == "percent"), self.number(metric["eligible_peer_sample_size"]))
            for key, metric in peers["metrics"].items()
        ], [210, 99, 99, 99])
        for key, metric in peers["metrics"].items():
            if metric["reason"]:
                self.story.append(self.p(f"{self.LABELS.get(key, metric['label'])}: {self.reason(metric['reason'])}", self.small))

    def additional_activity(
        self,
        sections,
    ):
        """Present source, route and timing observations without inferring visits or growth."""
        sources = sections["discovery_sources"]
        self.section("Where profile visits came from", new_page=True)
        self.story.append(self.p(self.source(sources["meta"]), self.small))
        self.story.append(self.p(
            "App-reported first successfully recorded source per account, business and UTC day. "
            "Unknown attribution is retained. These are online openings, not purchases or physical visits.",
            self.small,
        ))
        if sources["sources"] is None:
            self.story.append(self.p("Visit-source data is not available; missing counts are not zero."))
        else:
            self.table(
                ["Profile-opening source", "Recorded visits"],
                [
                    (row["label"], self.number(row["count"]))
                    for row in sources["sources"]
                ],
            )

        routes = sections["route_planning"]
        self.section("Route-planning activity")
        self.story.append(self.p(self.source(routes["meta"]), self.small))
        self.table(
            ["Measure", "Recorded result"],
            [
                ("Direction requests", self.number(routes["total_requests"])),
                ("Distinct explorer accounts", self.number(routes["distinct_explorer_accounts"])),
                ("Road Route requests", self.number(routes["road_route_requests"])),
                ("Jeepney guidance requests", self.number(routes["jeepney_requests"])),
            ],
        )
        self.story.append(self.p(
            "Requests indicate interest in directions, not confirmed journeys or arrivals. "
            "Each account can contribute once per business, method and UTC day. "
            "Delivery is best effort; activity before tracking began is unavailable. "
            f"Tracking started: {self.date(routes['tracking_started_at'], True)}.",
            self.small,
        ))

        self.reply_backlog(sections["unanswered_reviews"])
        timing = sections["profile_timing"]
        self.section("Recorded profile-visit timing", new_page=True)
        self.story.append(self.p(self.source(timing["sources"]["visibility"]), self.small))
        self.story.append(self.p(timing["measurement_note"], self.small))
        self.story.append(self.p(
            "Manila time. Values pool the same weekday/hour across selected dates. "
            "Brackets show selected calendar occurrences, not verified coverage; "
            "* marks an included partial hour. Counts are not adjusted for unequal exposure. "
            "Outside means the slot is outside the selected period. "
            "These records do not establish busiest hours or recommended opening hours.",
            self.small,
        ))
        cells = {
            (cell["weekday"], cell["hour"]): cell
            for cell in timing["cells"]
        }
        rows = []
        for hour in timing["hours"]:
            row = [f"{hour:02d}:00"]
            for weekday in timing["weekdays"]:
                cell = cells[(weekday["weekday"], hour)]
                if cell["state"] == "outside_period":
                    label = "Outside"
                else:
                    label = (
                        f"{self.number(cell['profile_visits'])} "
                        f"[{cell['period_occurrences']}]"
                    )
                if cell["includes_partial_hour"]:
                    label += "*"
                row.append(label)
            rows.append(row)
        self.table(
            ["Hour"] + [day["label"][:3] for day in timing["weekdays"]],
            rows,
            [52] + [65] * 7,
        )

    def reply_backlog(
        self,
        backlog,
    ):
        """Keep actionable review ages separate from period cohorts and timestamp anomalies."""
        self.section("Reviews needing replies - current age distribution")
        self.story.append(self.p(
            "Current actionable published-review backlog, independent of selected dates. "
            f"Snapshot: {self.date(backlog['snapshot_as_of'], True)}.",
            self.small,
        ))
        self.table(
            ["Waiting since review creation", "Reviews"],
            [
                ("Under 72 hours", self.number(backlog["under_3_days"])),
                ("72 hours to under 7 days", self.number(backlog["days_3_to_6"])),
                ("7 days or longer", self.number(backlog["days_7_plus"])),
                ("Total actionable unanswered", self.number(backlog["total_unanswered"])),
            ],
        )
        self.story.append(self.p(
            "Reviews with any retained reply are excluded from this actionable backlog, "
            "including replies with unusable timestamps. This can differ from the "
            "qualifying-reply backlog in Review performance.",
            self.small,
        ))

    def notes(self, report, metadata_refs):
        """Keep evidence caveats and deduplicated source windows behind the merchant results."""
        self.section("How to read this report", new_page=True)
        if report["results"]["premium"]["review_insights"]["stored_summary"] is None:
            self.story.append(self.p("Stored review summary: No stored review summary is available. "
                                    + self.source(report["results"]["premium"]["review_insights"]["meta"])))
        for item in report["key_findings"]:
            self.story.append(self.p(item["message"]))
        self.story.append(self.p(report["measurement_note"]))
        for key in ("visibility", "pocket", "review_performance", "review_insights"):
            self.story.append(self.p(report["results"]["premium"][key]["measurement_note"], self.small))
        period = report["meta"]["period"]
        previous_end = datetime.fromisoformat(period["previous_end_exclusive"]) - timedelta(microseconds=1)
        self.table(["Reporting information", "Value"], [
            ("Selected dates (Manila)", f"{self.date(period['start_date'])} to {self.date(period['end_date'])}"),
            ("Previous period (Manila)", f"{self.date(period['previous_start'])} to {self.date(previous_end.isoformat())}"),
            ("Snapshot cutoff (UTC)", report["snapshot_as_of"]),
            ("Report / policy version", f"{report['report_version']} / {report['policy_version']}"),
            ("Overall completeness", f"{report['meta']['availability'].capitalize()} - see the source notes below."),
        ], [200, 307])
        self.story.append(self.p("Bucket dates are starts in Manila time; first and last buckets are clipped to the selected window and reporting cutoff. Current-day results may be incomplete. Unsupported font characters are shown as [U+XXXX].", self.small))
        self.section("Source and availability notes")
        self.story.append(self.p("References identify source results, not separate businesses. 'Coverage verified' concerns that source's read scope; it does not remove the current-state or historical limitations below.", self.small))
        self.table(["Source / status", "Window (Manila)", "Coverage / data cutoff"], [
            (f"{reference}: {metadata['availability']}",
             f"{self.date(metadata['period']['start_date'])} to {self.date(metadata['period']['end_date'])}",
             f"Coverage verified: {'Yes' if metadata['coverage_verified'] else 'No'}. Data through: {self.date(metadata.get('data_through'), True)}.")
            for reference, metadata in metadata_refs.values()
        ], [110, 175, 222])
        issues = {}
        for reference, metadata in metadata_refs.values():
            for reason in metadata.get("partial_reasons", []):
                issues.setdefault(reason, []).append(reference)
            if metadata.get("generated_at") != report["snapshot_as_of"]:
                self.story.append(self.p(f"{reference} prepared: {self.date(metadata.get('generated_at'), True)}.", self.small))
        for reason, references in issues.items():
            self.story.append(self.p(f"{self.reason(reason)} Applies to {', '.join(references)}.", self.small))

    def build(self, report, metadata_refs):
        """Return ordered merchant-facing flowables without querying or changing report evidence."""
        self.metadata_refs = metadata_refs
        self.overview(report)
        self.activity(report["results"]["premium"])
        self.reviews(report["results"]["premium"])
        self.support_and_peers(report)
        if "export_sections" in report:
            self.additional_activity(report["export_sections"])
        self.notes(report, metadata_refs)
        return self.story
