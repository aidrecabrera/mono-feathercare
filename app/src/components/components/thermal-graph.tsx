import { supabase } from "@/client/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  Table as TanstackTable,
  useReactTable,
} from "@tanstack/react-table";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";

interface MonitorData {
  logged_at: string;
  min_temperature: number;
  max_temperature: number;
  avg_temperature: number;
  dateKey?: string;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

function DataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div>
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}

interface DataTablePaginationProps<TData> {
  table: TanstackTable<TData>;
}

function DataTablePagination<TData>({
  table,
}: DataTablePaginationProps<TData>) {
  return (
    <div className="flex items-center justify-between px-2 py-2">
      <div className="flex items-center space-x-2">
        <p className="text-sm font-medium">Rows per page</p>
        <Select
          value={`${table.getState().pagination.pageSize}`}
          onValueChange={(value: any) => table.setPageSize(Number(value))}
        >
          <SelectTrigger className="h-8 w-[70px]">
            <SelectValue placeholder={table.getState().pagination.pageSize} />
          </SelectTrigger>
          <SelectContent side="top">
            {[10, 20, 30, 40, 50].map((pageSize) => (
              <SelectItem key={pageSize} value={`${pageSize}`}>
                {pageSize}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex w-[100px] items-center justify-center text-sm font-medium">
        Page {table.getState().pagination.pageIndex + 1} of{" "}
        {table.getPageCount()}
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          className="w-8 h-8 p-0"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          <span className="sr-only">Go to first page</span>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          className="w-8 h-8 p-0"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <span className="sr-only">Go to previous page</span>
          <ChevronLeftIcon className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          className="w-8 h-8 p-0"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          <span className="sr-only">Go to next page</span>
          <ChevronRightIcon className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          className="w-8 h-8 p-0"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
        >
          <span className="sr-only">Go to last page</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

const RealTimeTemperatureChart = () => {
  const [monitorData, setMonitorData] = useState<MonitorData[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("daily");

  useEffect(() => {
    const fetchData = async () => {
      let query = supabase
        .from("monitor_log")
        .select("*")
        .order("logged_at", { ascending: true });

      const now = dayjs();
      if (selectedPeriod === "daily") {
        query = query.gte("logged_at", now.startOf("day").toISOString());
      } else if (selectedPeriod === "weekly") {
        query = query.gte("logged_at", now.startOf("week").toISOString());
      } else if (selectedPeriod === "monthly") {
        query = query.gte("logged_at", now.startOf("month").toISOString());
      }

      const { data: monitor } = await query;

      if (monitor) {
        const aggregatedData = aggregateData(monitor, selectedPeriod);
        setMonitorData(aggregatedData);
      }
    };

    fetchData();

    const intervalId = setInterval(fetchData, 1000);

    return () => clearInterval(intervalId);
  }, [selectedPeriod]);

  const aggregateData = (
    data: MonitorData[],
    period: string
  ): MonitorData[] => {
    if (period === "daily") return data;

    const aggregated: MonitorData[] = [];
    const formatMap: Record<string, string> = {
      weekly: "YYYY-MM-DD",
      monthly: "YYYY-MM",
    };
    const periodFormat = formatMap[period];

    data.forEach((item) => {
      const dateKey = dayjs(item.logged_at).format(periodFormat);
      let existing = aggregated.find((entry) => entry.dateKey === dateKey);

      if (!existing) {
        existing = {
          dateKey,
          logged_at: item.logged_at,
          min_temperature: item.min_temperature,
          max_temperature: item.max_temperature,
          avg_temperature: item.avg_temperature,
        };
        aggregated.push(existing);
      } else {
        existing.min_temperature = Math.min(
          existing.min_temperature,
          item.min_temperature
        );
        existing.max_temperature = Math.max(
          existing.max_temperature,
          item.max_temperature
        );
        existing.avg_temperature =
          (existing.avg_temperature + item.avg_temperature) / 2;
      }
    });

    return aggregated;
  };

  const columns: ColumnDef<MonitorData, any>[] = [
    {
      accessorKey: "logged_at",
      header: "Date/Time",
      cell: (info) => dayjs(info.getValue()).format("MM/DD/YYYY h:mm A"),
    },
    {
      accessorKey: "min_temperature",
      header: "Min Temperature",
    },
    {
      accessorKey: "max_temperature",
      header: "Max Temperature",
    },
    {
      accessorKey: "avg_temperature",
      header: "Avg Temperature",
    },
  ];

  return (
    <div>
      <Card className="max-w-full">
        <CardHeader>
          <div className="text-xl font-semibold text-center">
            Real Time Temperature
          </div>
          <div className="flex justify-center mt-4">
            <button
              className={`px-4 py-2 mx-2 ${
                selectedPeriod === "daily"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200"
              }`}
              onClick={() => setSelectedPeriod("daily")}
            >
              Daily
            </button>
            <button
              className={`px-4 py-2 mx-2 ${
                selectedPeriod === "weekly"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200"
              }`}
              onClick={() => setSelectedPeriod("weekly")}
            >
              Weekly
            </button>
            <button
              className={`px-4 py-2 mx-2 ${
                selectedPeriod === "monthly"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200"
              }`}
              onClick={() => setSelectedPeriod("monthly")}
            >
              Monthly
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              margin={{
                top: 0,
                right: 0,
                left: -25,
                bottom: 0,
              }}
              data={monitorData}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="logged_at"
                tickFormatter={(tick) =>
                  selectedPeriod === "daily"
                    ? dayjs(tick).format("MM/DD/YYYY h:mm A")
                    : selectedPeriod === "weekly"
                    ? dayjs(tick).format("MM/DD/YYYY")
                    : dayjs(tick).format("MM/YYYY")
                }
              />
              <YAxis />
              <Tooltip
                labelFormatter={(label) =>
                  selectedPeriod === "daily"
                    ? dayjs(label).format("MM/DD/YYYY h:mm A")
                    : selectedPeriod === "weekly"
                    ? dayjs(label).format("MM/DD/YYYY")
                    : dayjs(label).format("MM/YYYY")
                }
              />
              <Legend />
              <Line
                dot={false}
                strokeWidth={3}
                type="monotone"
                dataKey="min_temperature"
                stroke="#8884d8"
              />
              <Line
                dot={false}
                strokeWidth={3}
                type="monotone"
                dataKey="max_temperature"
                stroke="#82ca9d"
              />
              <Line
                dot={false}
                strokeWidth={3}
                type="monotone"
                dataKey="avg_temperature"
                stroke="#ffc658"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="max-w-full mt-6">
        <CardHeader>
          <div className="text-xl font-semibold text-center">
            Temperature Data Table
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={monitorData} />
        </CardContent>
      </Card>
    </div>
  );
};

export default RealTimeTemperatureChart;
