import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PIndicators {
  title: string;
  amount: string;
  lastRefreshed?: Date;
}

export default function Indicator({
  title,
  amount,
  lastRefreshed,
}: PIndicators) {
  const isHighFever = title === "High Fever" && amount === "Detected";
  const temperatureColor =
    title.includes("Temperature") && !title.includes("High Fever")
      ? parseFloat(amount) >= 38
        ? "text-red-500"
        : parseFloat(amount) >= 36
        ? "text-yellow-500"
        : "text-green-500"
      : "";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="w-full text-sm font-medium text-center">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`text-2xl font-bold ${
            isHighFever ? "text-red-500" : temperatureColor
          }`}
        >
          {amount}
        </div>
        {lastRefreshed && (
          <div className="w-full">
            Last Monitored at{" "}
            {lastRefreshed.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "numeric",
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
