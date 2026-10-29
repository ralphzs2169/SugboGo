import DataTable from "../../components/data-table/DataTable";
import AnalyticsSection from "./AnalyticsSection";
import AnalyticsReportSkeleton from "./AnalyticsReportSkeleton";

/** Frames the existing server-controlled Admin table without slicing or owning its state.
 * Unavailable rows stay distinct from an empty successful table.
 */
export default function AnalyticsTableSection({ tableProps, filters, unavailable = false, ...section }) {
  return (
    <AnalyticsSection
      hasData={Array.isArray(tableProps.data)}
      {...section}
      controls={filters ?? section.controls}
      unavailable={unavailable || tableProps.data === null}
      skeleton={<AnalyticsReportSkeleton kind="table" />}
    >
      {/* Existing table, filter slots and server pagination */}
      <DataTable
        {...tableProps}
        isLoading={false}
        isFetching={section.isFetching}
        error={null}
        config={{ showSearch: false, ...tableProps.config }}
      />
    </AnalyticsSection>
  );
}
