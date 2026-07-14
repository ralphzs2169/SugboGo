import React, { useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import { FaStore } from "react-icons/fa6";
import MsmeFilters from "./MsmeFilters";
import { handleTableFilterChange } from "@/features/admin-panel/components/data-table/tableUtils";
import {
  Plus,
  Utensils,
  Coffee,
  BedDouble,
  Flower2,
  MoreVertical,
  Filter,
} from "lucide-react";

// 1. Mock Data array containing row data matching image_0b9e45.png
const merchantData = [
  {
    id: "SUG-721-M",
    name: "Lantaw Native Restaurant",
    image:
      "https://images.unsplash.com/photo-1544025162-d76694265947?w=100&auto=format&fit=crop&q=60",
    cluster: "Culinary",
    clusterIcon: Utensils,
    clusterColor: "text-orange-600",
    tags: [
      {
        text: "Traditional",
        style: "bg-blue-50 text-blue-600 border-blue-100/70",
      },
      {
        text: "Seafront",
        style: "bg-slate-50 text-slate-400 border-slate-200/60",
      },
    ],
    status: "Active",
  },
  {
    id: "SUG-882-C",
    name: "The Coffee Trail",
    image:
      "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=100&auto=format&fit=crop&q=60",
    cluster: "Culinary",
    clusterIcon: Coffee,
    clusterColor: "text-teal-600",
    tags: [
      {
        text: "Eco-Friendly",
        style: "bg-emerald-50 text-emerald-600 border-emerald-100/70",
      },
      {
        text: "Artisan",
        style: "bg-slate-50 text-slate-400 border-slate-200/60",
      },
    ],
    status: "Active",
  },
  {
    id: "SUG-041-H",
    name: "Cebu Ocean Suites",
    image:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=100&auto=format&fit=crop&q=60",
    cluster: "Leisure",
    clusterIcon: BedDouble,
    clusterColor: "text-blue-600",
    tags: [
      {
        text: "Premium",
        style: "bg-amber-50 text-amber-700 border-amber-200/70",
      },
      {
        text: "Heritage",
        style: "bg-slate-50 text-slate-400 border-slate-200/60",
      },
    ],
    status: "Active",
  },
  {
    id: "SUG-505-S",
    name: "Island Soul Wellness",
    image:
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=100&auto=format&fit=crop&q=60",
    cluster: "Leisure",
    clusterIcon: Flower2,
    clusterColor: "text-purple-500",
    tags: [
      {
        text: "Organic",
        style: "bg-slate-100 text-slate-600 border-slate-200/70",
      },
      {
        text: "Holistic",
        style: "bg-slate-50 text-slate-400 border-slate-200/60",
      },
    ],
    status: "Suspended",
  },
];

const columnHelper = createColumnHelper();

// 2. TanStack Column Engine declarations
const columns = [
  columnHelper.accessor("name", {
    header: "MSME Name",
    cell: (info) => {
      const row = info.row.original;
      return (
        <div className="flex items-center gap-4 py-1">
          <img
            src={row.image}
            alt={row.name}
            className="h-12 w-12 rounded-xl object-cover bg-slate-100 shadow-inner"
          />
          <div>
            <h4 className="text-sm font-medium text-text-primary leading-tight">
              {row.name}
            </h4>
            <p className="text-[11px]  text-text-secondary tracking-wide mt-0.5">
              ID: {row.id}
            </p>
          </div>
        </div>
      );
    },
  }),
  columnHelper.accessor("cluster", {
    header: "Cluster",
    cell: (info) => {
      const row = info.row.original;
      const Icon = row.clusterIcon;
      return (
        <div className="flex items-center gap-2 text-text-primary text-xs font-bold">
          {Icon && <Icon className={`h-4 w-4 ${row.clusterColor}`} />}
          <span>{row.cluster}</span>
        </div>
      );
    },
  }),
  columnHelper.accessor("tags", {
    header: "Specialty Tags",
    enableSorting: false,
    cell: (info) => (
      <div className="flex flex-col items-center gap-2 pr-5">
        {info.getValue().map((tag, idx) => (
          <span
            key={idx}
            className={`rounded-full w-full border px-2.5 py-0.5 text-[10px]  ${tag.style}`}
          >
            {tag.text}
          </span>
        ))}
      </div>
    ),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => {
      const status = info.getValue();
      const isActive = status === "Active";
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs  ${
            isActive
              ? "bg-emerald-50 text-emerald-600"
              : "bg-rose-50 text-rose-600"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-rose-500"}`}
          />
          {status}
        </span>
      );
    },
  }),
  columnHelper.display({
    id: "actions",
    header: "Actions",
    enableSorting: false,
    cell: () => (
      <button className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors">
        <MoreVertical className="h-5 w-5" />
      </button>
    ),
  }),
];

function MsmeTable() {
  const [currentTab, setCurrentTab] = useState("active");
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);

  const handleResetFilters = () => {
    setGlobalFilter("");
    setColumnFilters([]);
    setSorting([]);
  };

  const hasActiveFilters =
    globalFilter.trim() !== "" ||
    columnFilters.length > 0 ||
    sorting.length > 0;

  return (
    <DataTable
      data={merchantData}
      columns={columns}
      // Hoisted States Object
      state={{
        globalFilter,
        sorting,
        columnFilters,
      }}
      onGlobalFilterChange={setGlobalFilter}
      onSortingChange={setSorting}
      onColumnFiltersChange={setColumnFilters}
      hasActiveFilters={hasActiveFilters}
      onResetFilters={handleResetFilters}
      // Concentrated Visual Props Block
      config={{
        tabs: [
          { id: "active", label: "Active MSMEs", count: 124 },
          { id: "applications", label: "Applications", count: 12 },
        ],
        activeTab: currentTab,
        onTabChange: setCurrentTab,
        searchPlaceholder: "Search by business name or category......",
        sortByText: "Recently Added",
        footerMetaText: "Showing 1 to 4 of 124 merchants",

        emptyState: {
          title: "No MSMEs found",
          description:
            "Try adjusting your search or filter to find the MSMEs you're looking for.",
          icon: <FaStore className="h-10 w-10 text-text-secondary" />,
        },
      }}
      // Functional Content Layout Injection Slots
      slots={{
        renderFilters: () => (
          <MsmeFilters
            columnFilters={columnFilters} // Pass state here!
            setColumnFilters={setColumnFilters}
            handleTableFilterChange={handleTableFilterChange}
          />
        ),
      }}
    />
  );
}

export default MsmeTable;
