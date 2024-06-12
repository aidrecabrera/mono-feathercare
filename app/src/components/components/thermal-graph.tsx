import { supabase } from "@/client/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useMediaQuery } from "react-responsive";
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

import { DatePickerWithPresets } from "@/components/components/date-picker";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import Indicator from "./indicators";

interface MonitorData {
  logged_at: string;
  min_temperature: number;
  max_temperature: number;
  avg_temperature: number;
  dateKey?: string;
}

interface FeverData {
  detected_at: string;
  min_temperature: number;
  max_temperature: number;
  avg_temperature: number;
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
  const [feverData, setFeverData] = useState<FeverData[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("daily");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  // @ts-ignore
  const [feverCount, setFeverCount] = useState<number>(0);
  const isPrintMode = useMediaQuery({ query: "print" });

  useEffect(() => {
    const fetchMonitorData = async () => {
      let query = supabase
        .from("monitor_log")
        .select("*")
        .order("logged_at", { ascending: false });

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
        setMonitorData(filterDataByDate(aggregatedData, selectedDate));
      }
    };

    const fetchFeverData = async () => {
      let query = supabase
        .from("fever_log")
        .select("*")
        .order("detected_at", { ascending: false });

      if (selectedDate) {
        const startOfDay = dayjs(selectedDate).startOf("day").toISOString();
        const endOfDay = dayjs(selectedDate).endOf("day").toISOString();
        query = query
          .gte("detected_at", startOfDay)
          .lte("detected_at", endOfDay);
      }

      const { data: fever } = await query;

      if (fever) {
        setFeverData(fever);
        setFeverCount(fever.length);
      } else {
        setFeverData([]);
        setFeverCount(0);
      }
    };

    fetchMonitorData();
    fetchFeverData();

    const monitorSubscription = supabase
      .channel("monitor_log")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "monitor_log" },
        (payload) => {
          setMonitorData((prevData) => {
            if (
              "logged_at" in payload.new &&
              "min_temperature" in payload.new &&
              "max_temperature" in payload.new &&
              "avg_temperature" in payload.new
            ) {
              const newData = [...prevData, payload.new as MonitorData];
              return filterDataByDate(
                aggregateData(newData, selectedPeriod),
                selectedDate
              );
            }
            return prevData;
          });
        }
      )
      .subscribe();

    const feverSubscription = supabase
      .channel("fever_log")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "fever_log" },
        (payload) => {
          // @ts-ignore
          setFeverData((prevData) => {
            const newEntry: FeverData = {
              detected_at: payload.new.detected_at || new Date(),
              min_temperature: payload.new.min_temperature || 0,
              max_temperature: payload.new.max_temperature || 0,
              avg_temperature: payload.new.avg_temperature || 0,
            };
            const newData = [...prevData, newEntry];
            // @ts-ignore
            return filterDataByDate(newData, selectedDate);
          });
          setFeverCount((prevCount) => prevCount + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(monitorSubscription);
      supabase.removeChannel(feverSubscription);
    };
  }, [selectedPeriod, selectedDate]);

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

  const filterDataByDate = <T extends { logged_at: string }>(
    data: T[],
    date?: Date
  ): T[] => {
    if (!date) return data;

    const startOfDay = dayjs(date).startOf("day").toISOString();
    const endOfDay = dayjs(date).endOf("day").toISOString();

    return data.filter(
      (item) => item.logged_at >= startOfDay && item.logged_at <= endOfDay
    );
  };

  const monitorColumns: ColumnDef<MonitorData, any>[] = [
    {
      accessorKey: "logged_at",
      header: "Date/Time",
      cell: (info) => dayjs(info.getValue()).format("MM/DD/YYYY h:mm A"),
    },
    {
      accessorKey: "min_temperature",
      header: "Min Temperature",
      cell: (info) => info.getValue().toFixed(2),
    },
    {
      accessorKey: "max_temperature",
      header: "Max Temperature",
      cell: (info) => info.getValue().toFixed(2),
    },
    {
      accessorKey: "avg_temperature",
      header: "Avg Temperature",
      cell: (info) => info.getValue().toFixed(2),
    },
  ];

  const feverColumns: ColumnDef<FeverData, any>[] = [
    {
      accessorKey: "detected_at",
      header: "Date/Time",
      cell: (info) => dayjs(info.getValue()).format("MM/DD/YYYY h:mm A"),
    },
    {
      accessorKey: "min_temperature",
      header: "Min Temperature",
      cell: (info) => info.getValue().toFixed(2),
    },
    {
      accessorKey: "max_temperature",
      header: "Max Temperature",
      cell: (info) => info.getValue().toFixed(2),
    },
    {
      accessorKey: "avg_temperature",
      header: "Avg Temperature",
      cell: (info) => info.getValue().toFixed(2),
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
              data={monitorData.slice().reverse()}
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

      {!isPrintMode && (
        <Tabs defaultValue="temperature">
          <div className="flex items-center justify-center gap-2 mt-4 -mb-2">
            <DatePickerWithPresets onDateChange={setSelectedDate} />
            <TabsList className="flex-grow max-w-sm">
              <TabsTrigger className="w-full" value="temperature">
                Temperature Logs
              </TabsTrigger>
              <TabsTrigger className="w-full" value="fever">
                Fever Logs
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="temperature">
            <Card className="max-w-full mt-6">
              <CardHeader>
                <div className="text-xl font-semibold text-center">
                  Temperature Logs
                </div>
              </CardHeader>
              <CardContent>
                <DataTable columns={monitorColumns} data={monitorData} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent className="flex flex-col gap-2 mt-6" value="fever">
            <Card className="max-w-full">
              <CardHeader>
                <div className="text-xl font-semibold text-center">
                  Fever Logs
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <DataTable columns={feverColumns} data={feverData} />
                <Indicator
                  title={
                    "Total Count of Fever Detected" +
                    (selectedDate
                      ? " on " + dayjs(selectedDate).format("MM/DD/YYYY")
                      : "")
                  }
                  amount={
                    feverData.length
                      ? `${feverData.length} ${
                          feverData.length > 1 ? "Times" : "Time"
                        }`
                      : "N/A"
                  }
                />
                <Indicator
                  title={`Min Temperature ${
                    feverData.length
                      ? selectedDate
                        ? "on " + dayjs(selectedDate).format("MM/DD/YYYY")
                        : ""
                      : ""
                  }`}
                  amount={
                    feverData.length
                      ? `${Math.min(
                          ...feverData.map((entry) => entry.min_temperature)
                        ).toFixed(2)}°`
                      : "N/A"
                  }
                />
                <Indicator
                  title={`Max Temperature ${
                    feverData.length
                      ? selectedDate
                        ? "on " + dayjs(selectedDate).format("MM/DD/YYYY")
                        : ""
                      : ""
                  }`}
                  amount={
                    feverData.length
                      ? `${Math.max(
                          ...feverData.map((entry) => entry.max_temperature)
                        ).toFixed(2)}°`
                      : "N/A"
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
      {isPrintMode && (
        <div>
          <Card className="max-w-full mt-6">
            <CardHeader>
              <div className="text-xl font-semibold text-center">
                Temperature Data Table
              </div>
            </CardHeader>
            <CardContent>
              <DataTable columns={monitorColumns} data={monitorData} />
            </CardContent>
          </Card>
          <Card className="max-w-full mt-6">
            <CardHeader>
              <div className="text-xl font-semibold text-center">Fever Log</div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <DataTable columns={feverColumns} data={feverData} />
              <Indicator
                title={
                  "Total Count of Fever Detected" +
                  (selectedDate
                    ? " on " + dayjs(selectedDate).format("MM/DD/YYYY")
                    : "")
                }
                amount={
                  feverData.length
                    ? `${feverData.length} ${
                        feverData.length > 1 ? "Times" : "Time"
                      }`
                    : "N/A"
                }
              />
              <Indicator
                title={`Min Temperature ${
                  feverData.length
                    ? selectedDate
                      ? "on " + dayjs(selectedDate).format("MM/DD/YYYY")
                      : ""
                    : ""
                }`}
                amount={
                  feverData.length
                    ? `${Math.min(
                        ...feverData.map((entry) => entry.min_temperature)
                      ).toFixed(2)}°`
                    : "N/A"
                }
              />
              <Indicator
                title={`Max Temperature ${
                  feverData.length
                    ? selectedDate
                      ? "on " + dayjs(selectedDate).format("MM/DD/YYYY")
                      : ""
                    : ""
                }`}
                amount={
                  feverData.length
                    ? `${Math.max(
                        ...feverData.map((entry) => entry.max_temperature)
                      ).toFixed(2)}°`
                    : "N/A"
                }
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default RealTimeTemperatureChart;
